#!/usr/bin/env bash
# Corrige el flag "late" de Carlos, Antonio y Marc en la Jornada 33 (J33).
# Ejecutar con: bash scripts/fix-j33-late.sh
#
# Requisitos: aws cli configurado con acceso a la tabla DynamoDB de producción.
# La tabla es PorraBirreros (o la que indique TABLE_NAME en la Lambda).

TABLE="${TABLE_NAME:-PorraBirreros}"
JORNADA="J33"
USERS=("Carlos" "Antonio" "Marc")

for USER in "${USERS[@]}"; do
  echo "→ Quitando late a $USER en $JORNADA..."
  aws dynamodb update-item \
    --table-name "$TABLE" \
    --key "{\"pk\":{\"S\":\"FUT#${JORNADA}\"},\"sk\":{\"S\":\"BET#${USER}\"}}" \
    --update-expression "SET #late = :false" \
    --expression-attribute-names '{"#late":"late"}' \
    --expression-attribute-values '{":false":{"BOOL":false}}' \
    --region eu-west-1
  echo "  ✓ $USER actualizado"
done

echo ""
echo "Hecho. Verifica en la app que las apuestas de Carlos, Antonio y Marc"
echo "en J33 aparecen como 'dentro de plazo'."
