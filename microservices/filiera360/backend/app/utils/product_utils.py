# Funzione di utilità per confrontare i dati vecchi e nuovi e restituire le modifiche effettive
def get_product_changes(old_data, new_data):
    changes = []
    for key in new_data:
        if key == "CustomObject":
            old_custom = old_data.get("CustomObject", {})
            new_custom = new_data.get("CustomObject", {})
            for subkey in new_custom:
                if old_custom.get(subkey) != new_custom.get(subkey):
                    changes.append({
                        "field": f"CustomObject.{subkey}",
                        "oldValue": old_custom.get(subkey),
                        "newValue": new_custom.get(subkey)
                    })
        else:
            if old_data.get(key) != new_data.get(key):
                changes.append({
                    "field": key,
                    "oldValue": old_data.get(key),
                    "newValue": new_data.get(key)
                })
    return changes