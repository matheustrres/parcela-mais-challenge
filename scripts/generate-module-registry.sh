#!/usr/bin/env bash
# scripts/generate-module-registry.sh
#
# Gera docs/module-registry.md a partir do código em src/modules/.
# Rode após implementar um módulo novo ou alterar endpoints/repositories.
#
# Uso:
#   chmod +x scripts/generate-module-registry.sh
#   ./scripts/generate-module-registry.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODULES_DIR="$PROJECT_ROOT/src/modules"
OUTPUT="$PROJECT_ROOT/docs/module-registry.md"
SCHEMA="$PROJECT_ROOT/prisma/schema.prisma"

# Header
cat > "$OUTPUT" << 'HEADER'
# Module Registry

> Gerado automaticamente por `scripts/generate-module-registry.sh`.
> Não edite manualmente — rode o script após alterar módulos.
>
> **Para agentes IA**: use este arquivo para localizar módulos, endpoints,
> repositórios e dependências sem explorar o filesystem.

HEADER

# Timestamp
echo "_Última atualização: $(date '+%Y-%m-%d %H:%M:%S')_" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# ── Prisma Models Summary ────────────────────────────────────────────
echo "---" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "## Prisma Models" >> "$OUTPUT"
echo "" >> "$OUTPUT"

if [[ -f "$SCHEMA" ]]; then
  echo '```' >> "$OUTPUT"
  grep -E '^model ' "$SCHEMA" | sed 's/model /- /' | sed 's/ {//' >> "$OUTPUT"
  echo '```' >> "$OUTPUT"
  echo "" >> "$OUTPUT"
  echo "Schema completo: \`prisma/schema.prisma\`" >> "$OUTPUT"
  echo "" >> "$OUTPUT"
fi

# ── Module Index ─────────────────────────────────────────────────────
echo "---" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "## Índice de Módulos" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "| Módulo | Endpoints | Repositórios | Services | Mappers |" >> "$OUTPUT"
echo "|:-------|:----------|:-------------|:---------|:--------|" >> "$OUTPUT"

for mod_dir in "$MODULES_DIR"/*/; do
  [[ ! -d "$mod_dir" ]] && continue
  mod_name=$(basename "$mod_dir")

  # Count files by type
  endpoints=$(grep -rch '@\(Get\|Post\|Patch\|Put\|Delete\)(' "$mod_dir"*.controller.ts 2>/dev/null | awk '{s+=$1} END {print s+0}')
  repos=$(find "$mod_dir" -path "*/repositories/*.ts" -not -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
  services=$(find "$mod_dir" -path "*/services/*.ts" -not -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
  mappers=$(find "$mod_dir" -path "*/mappers/*.ts" -not -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')

  echo "| [\`${mod_name}\`](#${mod_name}) | ${endpoints} | ${repos} | ${services} | ${mappers} |" >> "$OUTPUT"
done

echo "" >> "$OUTPUT"

# ── Detailed Module Sections ─────────────────────────────────────────
for mod_dir in "$MODULES_DIR"/*/; do
  [[ ! -d "$mod_dir" ]] && continue
  mod_name=$(basename "$mod_dir")

  echo "---" >> "$OUTPUT"
  echo "" >> "$OUTPUT"
  echo "## ${mod_name}" >> "$OUTPUT"
  echo "" >> "$OUTPUT"
  echo "Path: \`src/modules/${mod_name}/\`" >> "$OUTPUT"
  echo "" >> "$OUTPUT"

  # ── Files ──
  echo "### Arquivos" >> "$OUTPUT"
  echo "" >> "$OUTPUT"
  echo '```' >> "$OUTPUT"
  find "$mod_dir" -name "*.ts" -not -name "*.spec.ts" -not -name "*.d.ts" \
    | sed "s|$mod_dir||" | sort >> "$OUTPUT"
  echo '```' >> "$OUTPUT"
  echo "" >> "$OUTPUT"

  # ── Endpoints ──
  controller_file=$(find "$mod_dir" -maxdepth 1 -name "*.controller.ts" 2>/dev/null | head -1)
  if [[ -n "$controller_file" && -f "$controller_file" ]]; then
    echo "### Endpoints" >> "$OUTPUT"
    echo "" >> "$OUTPUT"

    # Extract base route from @Controller
    base_route=$(grep -oP "@Controller\(['\"]?\K[^'\")]+" "$controller_file" 2>/dev/null || echo "")

    # Extract guards and roles at class level
    class_guards=$(grep -oP "@UseGuards\(\K[^)]+" "$controller_file" 2>/dev/null | head -1 || echo "")
    class_roles=$(grep -B1 'class ' "$controller_file" | grep -oP "@Roles\(\K[^)]+" 2>/dev/null || echo "")

    if [[ -n "$class_guards" ]]; then
      echo "Guards: \`${class_guards}\`" >> "$OUTPUT"
      echo "" >> "$OUTPUT"
    fi

    echo "| Verbo | Rota | Roles | Audit |" >> "$OUTPUT"
    echo "|:------|:-----|:------|:------|" >> "$OUTPUT"

    # Parse endpoints: look for @Get/@Post/@Patch/@Put/@Delete followed by method
    grep -nE '@(Get|Post|Patch|Put|Delete)\(' "$controller_file" 2>/dev/null | while IFS=: read -r line_num match; do
      verb=$(echo "$match" | grep -oP '@\K(Get|Post|Patch|Put|Delete)')
      sub_route=$(echo "$match" | grep -oP "@${verb}\(['\"]?\K[^'\"]*" | head -1)

      full_route="/${base_route}"
      [[ -n "$sub_route" ]] && full_route="${full_route}/${sub_route}"
      full_route=$(echo "$full_route" | sed 's|//|/|g')

      # Look backwards for @Roles and @Audit near this endpoint (within 5 lines before)
      start_line=$((line_num - 5))
      [[ $start_line -lt 1 ]] && start_line=1
      context=$(sed -n "${start_line},${line_num}p" "$controller_file")

      roles=$(echo "$context" | grep -oP "@Roles\(\K[^)]+" 2>/dev/null | tail -1 || echo "—")
      audit=$(echo "$context" | grep -oP "@Audit\(\K[^)]+" 2>/dev/null | tail -1 || echo "—")

      echo "| ${verb^^} | \`${full_route}\` | ${roles} | ${audit} |" >> "$OUTPUT"
    done

    echo "" >> "$OUTPUT"
  fi

  # ── Repository Methods ──
  repo_files=$(find "$mod_dir" -path "*/repositories/*.ts" -not -name "*.spec.ts" 2>/dev/null)
  if [[ -n "$repo_files" ]]; then
    echo "### Repository" >> "$OUTPUT"
    echo "" >> "$OUTPUT"

    for repo_file in $repo_files; do
      repo_basename=$(basename "$repo_file")
      echo "**\`${repo_basename}\`**" >> "$OUTPUT"
      echo "" >> "$OUTPUT"
      echo '```' >> "$OUTPUT"
      # Extract async method signatures
      grep -E '^\s*async\s+\w+' "$repo_file" 2>/dev/null \
        | sed 's/^\s*//' | sed 's/{$//' | sed 's/\s*$//' >> "$OUTPUT"
      echo '```' >> "$OUTPUT"
      echo "" >> "$OUTPUT"
    done
  fi

  # ── Service Methods ──
  service_files=$(find "$mod_dir" -path "*/services/*.ts" -not -name "*.spec.ts" 2>/dev/null)
  if [[ -n "$service_files" ]]; then
    echo "### Services" >> "$OUTPUT"
    echo "" >> "$OUTPUT"

    for svc_file in $service_files; do
      svc_basename=$(basename "$svc_file")
      echo "**\`${svc_basename}\`**" >> "$OUTPUT"
      echo "" >> "$OUTPUT"
      echo '```' >> "$OUTPUT"
      grep -E '^\s*async\s+\w+' "$svc_file" 2>/dev/null \
        | sed 's/^\s*//' | sed 's/{$//' | sed 's/\s*$//' >> "$OUTPUT"
      echo '```' >> "$OUTPUT"
      echo "" >> "$OUTPUT"
    done
  fi

  # ── DTOs ──
  dto_files=$(find "$mod_dir" -path "*/dto/*.ts" -not -name "*.spec.ts" 2>/dev/null)
  if [[ -n "$dto_files" ]]; then
    echo "### DTOs" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    for dto_file in $dto_files; do
      echo "- \`$(basename "$dto_file")\`" >> "$OUTPUT"
    done
    echo "" >> "$OUTPUT"
  fi

  # ── Module Dependencies ──
  module_file=$(find "$mod_dir" -maxdepth 1 -name "*.module.ts" 2>/dev/null | head -1)
  if [[ -n "$module_file" && -f "$module_file" ]]; then
    imports=$(grep -oP 'imports:\s*\[\K[^\]]+' "$module_file" 2>/dev/null | tr ',' '\n' | sed 's/^\s*//' | sed '/^$/d' || echo "")
    exports=$(grep -oP 'exports:\s*\[\K[^\]]+' "$module_file" 2>/dev/null | tr ',' '\n' | sed 's/^\s*//' | sed '/^$/d' || echo "")

    if [[ -n "$imports" || -n "$exports" ]]; then
      echo "### Dependências" >> "$OUTPUT"
      echo "" >> "$OUTPUT"
      if [[ -n "$imports" ]]; then
        echo "Imports: $(echo "$imports" | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')" >> "$OUTPUT"
        echo "" >> "$OUTPUT"
      fi
      if [[ -n "$exports" ]]; then
        echo "Exports: $(echo "$exports" | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')" >> "$OUTPUT"
        echo "" >> "$OUTPUT"
      fi
    fi
  fi

done

echo "---" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "_Gerado por \`scripts/generate-module-registry.sh\`_" >> "$OUTPUT"

echo "✓ Registry gerado em: $OUTPUT"
echo "  $(grep -c '^## ' "$OUTPUT") módulos documentados"