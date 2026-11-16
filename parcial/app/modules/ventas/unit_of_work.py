from sqlalchemy.ext.asyncio import AsyncSession
from app.core.unit_of_work import UnitOfWork
from app.modules.libros.repository import LibroRepository, MovimientoStockRepository
from app.modules.ventas.repository import RenglonVentaRepository, VentaRepository


class VentaUnitOfWork(UnitOfWork):
    def __init__(self, session: AsyncSession):
        super().__init__(session)
        self.ventas = VentaRepository(session)
        self.renglones = RenglonVentaRepository(session)
        self.libros = LibroRepository(session)
        self.movimientos = MovimientoStockRepository(session)