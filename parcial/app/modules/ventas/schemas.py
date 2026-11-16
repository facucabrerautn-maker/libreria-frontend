from decimal import Decimal
from datetime import datetime
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field


class RenglonVentaCreate(BaseModel):
    """Renglón de venta para crear una venta."""
    model_config = ConfigDict(extra="forbid")

    libro_id: int = Field(..., gt=0)
    cantidad: int = Field(..., gt=0)


class VentaCreate(BaseModel):
    """Datos para crear una venta."""
    model_config = ConfigDict(extra="forbid")

    cliente_id: int = Field(..., gt=0)
    renglones: Annotated[list[RenglonVentaCreate], Field(..., min_length=1)]


class RenglonVentaResponse(BaseModel):
    """Renglón de venta en respuesta (con precio histórico congelado)."""
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: int
    libro_id: int
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal


class VentaResponse(BaseModel):
    """Venta en respuesta (listado)."""
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: int
    fecha: datetime
    total: Decimal
    cliente_id: int
    cliente_nombre: str | None = None


class VentaDetalleResponse(BaseModel):
    """Venta con detalle completo (historial)."""
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: int
    fecha: datetime
    total: Decimal
    cliente_id: int
    cliente_nombre: str | None = None
    renglones: list[RenglonVentaResponse]