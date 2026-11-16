from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.paginacion import PaginaResponse, calcular_paginacion
from app.modules.ventas.schemas import (
    RenglonVentaCreate,
    VentaCreate,
    VentaDetalleResponse,
    VentaResponse,
)
from app.modules.ventas.service import VentaService
from app.modules.ventas.unit_of_work import VentaUnitOfWork


router_abierto = APIRouter(prefix="/ventas", tags=["Ventas (Público)"])
router_protegido = APIRouter(prefix="/ventas", tags=["Ventas (Protegido)"])


def get_uow(session: AsyncSession = Depends(get_session)) -> VentaUnitOfWork:
    return VentaUnitOfWork(session)


class VentasPaginacionParams:
    """Parámetros de paginación para ventas: limit y offset (según consigna Global)."""

    def __init__(
        self,
        limit: int = Query(20, ge=1, le=100, description="Cantidad de elementos por página (1 a 100)"),
        offset: int = Query(0, ge=0, description="Desplazamiento inicial (desde 0)"),
    ):
        self.limit = limit
        self.offset = offset

    @property
    def page(self) -> int:
        return (self.offset // self.limit) + 1

    @property
    def size(self) -> int:
        return self.limit


@router_abierto.get(
    "",
    response_model=PaginaResponse[VentaResponse],
    status_code=status.HTTP_200_OK,
)
async def listar_ventas(
    params: VentasPaginacionParams = Depends(),
    uow: VentaUnitOfWork = Depends(get_uow),
) -> PaginaResponse[VentaResponse]:
    """Lista ventas paginadas (más recientes primero). Usa limit y offset."""
    pages, _ = calcular_paginacion(0, params.page, params.size)  # total se calcula en service
    return await VentaService.listar(uow, page=params.page, size=params.size)


@router_abierto.get(
    "/{id}",
    response_model=VentaDetalleResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_venta(
    id: int,
    uow: VentaUnitOfWork = Depends(get_uow),
) -> VentaDetalleResponse:
    """Obtiene el detalle completo de una venta con sus renglones e importes históricos."""
    return await VentaService.obtener_por_id(uow, id)


@router_abierto.post(
    "",
    response_model=VentaDetalleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_venta(
    data: VentaCreate,
    uow: VentaUnitOfWork = Depends(get_uow),
) -> VentaDetalleResponse:
    """
    Registra una nueva venta.

    Reglas de validación:
    - Cliente debe existir (409 si no)
    - Al menos un renglón (422 si vacío)
    - Sin libros repetidos en la misma venta (422)
    - Libro debe existir y estar vigente (409)
    - Stock suficiente (409)
    - Congela precio_unitario en cada renglón (precio histórico)
    - Descuenta stock y registra MovimientoStock
    """
    return await VentaService.crear(uow, data)