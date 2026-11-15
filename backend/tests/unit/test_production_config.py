import pytest

from config import (
    _validate_database_name_for_environment,
    _validate_production_database_credentials,
    _validate_production_database_tls,
)


@pytest.mark.parametrize("environment", ["development", "production"])
def test_non_test_environment_rejects_the_backend_test_database(environment):
    with pytest.raises(RuntimeError, match="reservado aos testes"):
        _validate_database_name_for_environment(environment, "wepay_test")


def test_testing_environment_can_use_the_backend_test_database():
    _validate_database_name_for_environment("testing", "wepay_test")


@pytest.mark.parametrize("user", ["", " ", "root", "ROOT"])
def test_production_database_rejects_empty_or_root_users(user):
    with pytest.raises(RuntimeError, match="DB_USER deve ser uma conta dedicada"):
        _validate_production_database_credentials(user, "configured-password")


@pytest.mark.parametrize("password", ["", " ", "\t"])
def test_production_database_rejects_empty_passwords(password):
    with pytest.raises(RuntimeError, match="DB_PASSWORD deve ser configurada"):
        _validate_production_database_credentials("wepay_app", password)


def test_production_database_accepts_dedicated_account_with_password():
    _validate_production_database_credentials("wepay_app", "configured-password")


@pytest.mark.parametrize("ca_path", ["", " "])
def test_production_database_rejects_missing_tls_ca(ca_path):
    with pytest.raises(RuntimeError, match="DB_SSL_CA deve apontar"):
        _validate_production_database_tls(ca_path)


def test_production_database_rejects_missing_tls_ca_file(tmp_path):
    with pytest.raises(RuntimeError, match="arquivo CA existente"):
        _validate_production_database_tls(str(tmp_path / "missing-ca.pem"))


def test_production_database_accepts_existing_tls_ca_file(tmp_path):
    ca_file = tmp_path / "mysql-ca.pem"
    ca_file.write_text("test CA", encoding="utf-8")

    assert _validate_production_database_tls(str(ca_file)) == str(ca_file)
