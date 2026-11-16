from decimal import Decimal
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import select
from app.core.paginacion import PaginaResponse, calcular_paginacion
from app.modules.clientes.models import Cliente
from app.modules.libros.models import Libro, MovimientoStock
from app.modules.ventas.models import RenglonVenta, Venta
from app.modules.ventas.schemas import (
    RenglonVentaCreate,
    RenglonVentaResponse,
    VentaCreate,
    VentaDetalleResponse,
    VentaResponse,
)
from app.modules.ventas.unit_of_work import VentaUnitOfWork


class VentaService:
    @staticmethod
    async def listar(
        uow: VentaUnitOfWork,
        page: int,
        size: int,
    ) -> PaginaResponse[VentaResponse]:
        async with uow:
            total = await uow.ventas.contar_todas()
            pages, offset = calcular_paginacion(total, page, size)
            items = await uow.ventas.buscar_por_criterios(offset=offset, limit=size)
            return PaginaResponse(
                items=[
                    VentaResponse(
                        id=v.id,
                        fecha=v.fecha,
                        total=v.total,
                        cliente_id=v.cliente_id,
                        cliente_nombre=v.cliente.nombre if v.cliente else None,
                    )
                    for v in items
                ],
                total=total,
                page=page,
                size=size,
                pages=pages,
            )

    @staticmethod
    async def obtener_por_id(
        uow: VentaUnitOfWork, id: int
    ) -> VentaDetalleResponse:
        async with uow:
            venta = await uow.ventas.obtener_con_renglones(id)
            if not venta:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada"
                )
            return VentaDetalleResponse(
                id=venta.id,
                fecha=venta.fecha,
                total=venta.total,
                cliente_id=venta.cliente_id,
                cliente_nombre=venta.cliente.nombre if venta.cliente else None,
                renglones=[
                    RenglonVentaResponse(
                        id=r.id,
                        libro_id=r.libro_id,
                        cantidad=r.cantidad,
                        precio_unitario=r.precio_unitario,
                        subtotal=r.cantidad * r.precio_unitario,
                    )
                    for r in venta.renglones
                ],
            )

    @staticmethod
    async def crear(
        uow: VentaUnitOfWork, data: VentaCreate
    ) -> VentaDetalleResponse:
        """
        Crea una venta con las siguientes validaciones:
        - Cliente debe existir
        - Al menos un renglón
        - Sin libros repetidos en la misma venta
        - Cada libro debe existir y estar vigente (no borrado)
        - Stock suficiente
        - Congela precio_unitario en cada renglón (precio histórico)
        - Descuenta stock y registra MovimientoStock
        """
        async with uow:
            # 1. Verificar cliente
            cliente = await uow.session.get(Cliente, data.cliente_id)
            if not cliente:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El cliente especificado no existe.",
                )

            # 2. Validar renglones: al menos uno, sin duplicados
            if not data.renglones:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="La venta debe tener al menos un renglón.",
                )

            libros_vistos = set()
            renglones_para_crear = []

            for renglon_in in data.renglones:
                # Verificar duplicados en la misma venta
                if renglon_in.libro_id in libros_vistos:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"El libro {renglon_in.libro_id} está repetido en la venta.",
                    )
                libros_vistos.add(renglon_in.libro_id)

                # 3. Verificar libro existe y está vigente
                libro = await uow.session.get(Libro, renglon_in.libro_id)
                if not libro or libro.borrado_en is not None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"El libro {renglon_in.libro_id} no existe o fue dado de baja.",
                    )

                # 4. Verificar stock suficiente
                if libro.stock < renglon_in.cantidad:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Stock insuficiente para '{libro.titulo}' (disponible: {libro.stock}, solicitado: {renglon_in.cantidad}).",
                    )

                # 5. Congelar precio histórico y preparar renglón
                precio_unitario = Decimal(str(libro.precio))
                renglones_para_crear.append(
                    {
                        "libro_id": libro.id,
                        "cantidad": renglon_in.cantidad,
                        "precio_unitario": precio_unitario,
                        "libro_obj": libro,
                    }
                )

            # 6. Calcular total
            total = sum(
                Decimal(str(r["cantidad"])) * r["precio_unitario"]
                for r in renglones_para_crear
            )

            # 7. Crear venta
            venta = Venta(
                fecha=datetime.now(timezone.utc),
                total=total,
                cliente_id=data.cliente_id,
            )
            await uow.ventas.add(venta)

            # 8. Crear renglones, descontar stock y registrar movimientos
            for r in renglones_para_crear:
                renglon = RenglonVenta(
                    venta_id=venta.id,
                    libro_id=r["libro_id"],
                    cantidad=r["cantidad"],
                    precio_unitario=r["precio_unitario"],
                )
                await uow.renglones.add(renglon)

                # Descontar stock
                libro = r["libro_obj"]
                libro.stock -= r["cantidad"]
                await uow.libros.update(libro)

                # Registrar movimiento de stock (salida por venta)
                mov = MovimientoStock(
                    libro_id=libro.id,
                    venta_id=venta.id,
                    usuario_id=1,  # TODO: obtener del usuario autenticado cuando haya auth
                    cantidad=-r["cantidad"],
                    motivo="Venta",
                )
                await uow.movimientos.add(mov)

            # Refrescar para tener relaciones cargadas
            await uow.session.refresh(venta)

            # Retornar detalle completo
            venta_con_renglones = await uow.ventas.obtener_con_renglones(venta.id)
            return VentaDetalleResponse(
                id=venta_con_renglones.id,
                fecha=venta_con_renglones.fecha,
                total=venta_con_renglones.total,
                cliente_id=venta_con_renglones.cliente_id,
                cliente_nombre=venta_con_renglones.cliente.nombre if venta_con_renglones.cliente else None,
                renglones=[
                    RenglonVentaResponse(
                        id=r.id,
                        libro_id=r.libro_id,
                        cantidad=r.cantidad,
                        precio_unitario=r.precio_unitario,
                        subtotal=r.cantidad * r.precio_unitario,
                    )
                    for r in venta_con_renglones.renglones
                ],
            )