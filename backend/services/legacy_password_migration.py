import secrets

from database.connection import cursor_for, fetch_all
from utils.password_utils import hash_password, is_legacy_password_hash


def invalidate_legacy_passwords(connection, dry_run=True):
    """Replace legacy SHA-256 hashes with unusable bcrypt hashes."""
    cursor = cursor_for(connection)
    try:
        query = (
            "SELECT id, senha FROM usuarios WHERE CHAR_LENGTH(senha) = 64"
            if dry_run
            else "SELECT id, senha FROM usuarios "
            "WHERE CHAR_LENGTH(senha) = 64 FOR UPDATE"
        )
        cursor.execute(query)
        users = [
            user
            for user in fetch_all(cursor)
            if is_legacy_password_hash(user["senha"])
        ]
        if dry_run:
            return len(users)

        for user in users:
            cursor.execute(
                """
                UPDATE usuarios
                SET senha = ?, auth_version = auth_version + 1,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ? AND senha = ?
                """,
                (
                    hash_password(secrets.token_urlsafe(48)),
                    user["id"],
                    user["senha"],
                ),
            )
            if cursor.rowcount != 1:
                raise RuntimeError(
                    "Não foi possível invalidar uma senha legada; "
                    "a transação precisa ser revertida."
                )
            cursor.execute(
                "UPDATE refresh_tokens SET revogado_em = CURRENT_TIMESTAMP "
                "WHERE usuario_id = ? AND revogado_em IS NULL",
                (user["id"],),
            )
        return len(users)
    finally:
        cursor.close()
