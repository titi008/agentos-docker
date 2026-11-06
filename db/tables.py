"""Application-owned tables in the shared AgentOS database."""

from sqlalchemy import Connection, Table
from sqlalchemy.schema import CreateSchema, CreateTable


def ensure_table(conn: Connection, table: Table) -> None:
    """Create the table, and its schema, if they don't exist yet."""
    if table.schema:
        conn.execute(CreateSchema(table.schema, if_not_exists=True))
    conn.execute(CreateTable(table, if_not_exists=True))
