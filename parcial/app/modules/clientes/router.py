from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.dependencies import requiere_rol
from app.core.paginacion import PaginaResponse, PaginacionParams, calcular_paginacion
from app.modules.clientes.schemas import (
    ClienteCreate,
    ClienteResponse,
    ClienteUpdate,
    PerfilClienteCreate,
    PerfilClienteResponse,
)
from app.modules.clientes.service import ClienteService
from app.modules.clientes.unit_of_work import ClienteUnitOfWork

# Router público: GET por ID para selectores, POST para crear clientes (frontend)
router_abierto = APIRouter(prefix="/clientes", tags=["Clientes (Público)"])
# Router protegido: operaciones administrativas
router_protegido = APIRouter(prefix="/clientes", tags=["Clientes (Protegido)"])


def get_uow(session: AsyncSession = Depends(get_session)) -> ClienteUnitOfWork:
    return ClienteUnitOfWork(session)


# ---- Público: accesible desde el frontend sin auth ----

@router_abierto.get(
    "",
    response_model=PaginaResponse[ClienteResponse],
    status_code=status.HTTP_200_OK,
)
async def listar_clientes_publico(
    params: PaginacionParams = Depends(),
    uow: ClienteUnitOfWork = Depends(get_uow),
) -> PaginaResponse[ClienteResponse]:
    """Lista clientes paginados (público para selectores y listado del frontend)."""
    async with uow:
        total = await uow.clientes.count()
        pages, offset = calcular_paginacion(total, params.page, params.size)
        items = await uow.clientes.get_all(offset=offset, limit=params.size)
        return PaginaResponse(
            items=[ClienteResponse.model_validate(c) for c in items],
            total=total,
            page=params.page,
            size=params.size,
            pages=pages,
        )


@router_abierto.get(
    "/{id}",
    response_model=ClienteResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_cliente_publico(
    id: int,
    uow: ClienteUnitOfWork = Depends(get_uow),
) -> ClienteResponse:
    """Obtiene un cliente por ID (público para verificar y mostrar nombre en ventas)."""
    return await ClienteService.obtener_por_id(uow, id)


@router_abierto.post(
    "",
    response_model=ClienteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_cliente_publico(
    data: ClienteCreate,
    uow: ClienteUnitOfWork = Depends(get_uow),
) -> ClienteResponse:
    """Crea un cliente (público para el frontend del Global)."""
    return await ClienteService.crear(uow, data)


# ---- Protegido: requiere auth y rol ----

@router_protegido.get(
    "/{id}",
    response_model=ClienteResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(requiere_rol("VENDEDOR", "ADMIN"))],
)
async def obtener_cliente(
    id: int,
    uow: ClienteUnitOfWork = Depends(get_uow),
) -> ClienteResponse:
    return await ClienteService.obtener_por_id(uow, id)


@router_protegido.post(
    "",
    response_model=ClienteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requiere_rol("VENDEDOR", "ADMIN"))],
)
async def crear_cliente(
    data: ClienteCreate,
    uow: ClienteUnitOfWork = Depends(get_uow),
) -> ClienteResponse:
    return await ClienteService.crear(uow, data)


@router_protegido.patch(
    "/{id}",
    response_model=ClienteResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(requiere_rol("VENDEDOR", "ADMIN"))],
)
async def actualizar_cliente(
    id: int,
    data: ClienteUpdate,
    uow: ClienteUnitOfWork = Depends(get_uow),
) -> ClienteResponse:
    return await ClienteService.actualizar(uow, id, data)


@router_protegido.post(
    "/{id}/perfil",
    response_model=PerfilClienteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requiere_rol("VENDEDOR", "ADMIN"))],
)
async def crear_perfil_cliente(
    id: int,
    data: PerfilClienteCreate,
    uow: ClienteUnitOfWork = Depends(get_uow),
) -> PerfilClienteResponse:
    return await ClienteService.crear_perfil(uow, id, data)


@router_protegido.get(
    "/{id}/ventas",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(requiere_rol("VENDEDOR", "ADMIN"))],
)
async def obtener_ventas_cliente(
    id: int,
    uow: ClienteUnitOfWork = Depends(get_uow),
) -> list[dict]:
    return await ClienteService.obtener_ventas(uow, id)
