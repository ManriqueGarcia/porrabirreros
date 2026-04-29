#!/usr/bin/env bash
# Corrige el flag "late" de Carlos, Antonio y Marc en la Jornada 33 (J33).
# Ejecutar con: bash scripts/fix-j33-late.sh
#
# Variables (opcionales, deben coincidir con la Lambda porra-state-api):
#   TABLE_NAME   — tabla DynamoDB (por defecto PorraBirreros, igual que porra-state-api.mjs)
#   AWS_REGION   — región (por defecto us-east-1)
#   PORRA_GROUP_ID — id de grupo en la clave pk=G#<id> (por defecto birreros).
#                    Tiene prioridad sobre GROUP si ambas están definidas.
#   GROUP          — alternativa a PORRA_GROUP_ID (útil: GROUP=otro bash scripts/fix-j33-late.sh).
# Formato de clave: pk=G#<grupo>, sk=FUT#J33|BET#<nombre>

TABLE="${TABLE_NAME:-PorraBirreros}"
REGION="${AWS_REGION:-us-east-1}"
GROUP="${PORRA_GROUP_ID:-${GROUP:-birreros}}"
JORNADA="J33"
USERS=("Carlos" "Antonio" "Marc")

echo "Tabla: $TABLE | Región: $REGION | Grupo (pk G#…): $GROUP"
echo ""

for USER in "${USERS[@]}"; do
  echo "→ Quitando late a $USER en $JORNADA..."
  aws dynamodb update-item \
    --table-name "$TABLE" \
    --key "{\"pk\":{\"S\":\"G#${GROUP}\"},\"sk\":{\"S\":\"FUT#${JORNADA}|BET#${USER}\"}}" \
    --update-expression "SET #late = :false" \
    --expression-attribute-names '{"#late":"late"}' \
    --expression-attribute-values '{":false":{"BOOL":false}}' \
    --region "$REGION" \
    --profile default
  echo "  ✓ $USER actualizado"
done

echo ""
echo "Hecho. Verifica en la app que las apuestas de Carlos, Antonio y Marc"
echo "en J33 aparecen como 'dentro de plazo'."
