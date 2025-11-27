def required_permissions(user, roles):
    """Verifica se il manufacturer ha almeno uno dei ruoli richiesti."""
    print("chiamata a required permissions")
    if not user:
        return False

    role_map = {"producer": 0, "operator": 1, "user": 2}
    for role in roles:
        if user["flags"][role_map[role]]:
            return True
    return False
