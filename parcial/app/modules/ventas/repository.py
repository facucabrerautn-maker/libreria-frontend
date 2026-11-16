from decimal import Decimal
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.repository import BaseRepository
from app.modules.ventas.models import RenglonVenta, Venta


class VentaRepository(BaseRepository[Venta]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, Venta)

    async def buscar_por_criterios(
        self,
        offset: int = 0,
        limit: int = 100,
    ) -> list[Venta]:
        """Lista ventas ordenadas por fecha descendente (más reciente primero)."""
        stmt = (
            select(Venta)
            .order_by(Venta.fecha.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def contar_todas(self) -> int:
        """Cuenta el total de ventas."""
        stmt = select(func.count()).select_from(Venta)
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def obtener_con_renglones(self, id: int) -> Venta | None:
        """Obtiene una venta con sus renglones cargados (eager loading)."""
        from sqlalchemy.orm import selectinload
        stmt = (
            select(Venta)
            .options(selectinload(Venta.renglones))
            .where(Venta.id == id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()


class RenglonVentaRepository(BaseRepository[RenglonVenta]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, RenglonVenta)