# 0.6 — Supply chain: Dependabot + secret scanning

## Por qué

Una app que custodia material criptográfico **no puede** convivir con dependencias desactualizadas con CVE conocidos, ni con secretos commiteados accidentalmente al historial.

## Cambios aplicados

### 1) `.github/dependabot.yml`

Configura Dependabot para:

- **npm**: revisión semanal (lunes).
- **github-actions**: revisión mensual.
- **docker**: revisión mensual.
- **groupBy**: agrupar minor/patch en un solo PR (menos ruido); major por separado.

### 2) Secret scanning (GitHub)

Habilitar en `Settings → Code security and analysis`:

- ✅ **Secret scanning** (activado).
- ✅ **Push protection** (bloquea pushes con secretos detectados).
- ✅ **Dependabot alerts**.
- ✅ **Dependabot security updates**.

Estos toggles no son código, pero quedan documentados aquí como **parte del entregable de Fase 0**. La verificación es manual: capturar pantalla y archivar en `auditoria_fase0/screenshots/` cuando se haga.

### 3) Pre-commit hook (opcional pero recomendado)

```bash
# .git/hooks/pre-commit
#!/bin/sh
if git diff --cached -G "(AKIA|ghp_|gho_|ghu_|ghr_|ghs_|api[_-]?key|secret)" | grep -E "^\+"; then
  echo "❌ Posible secreto detectado en cambios staged."
  exit 1
fi
```

O usar [`gitleaks`](https://github.com/gitleaks/gitleaks) en CI:

```yaml
- name: Gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

(Se añade en Fase 4 cuando endurezcamos supply chain — para Fase 0 basta con la configuración de plataforma.)

## Política de actualizaciones durante la remediación

- **Patch/minor de dependencias no críticas**: auto-merge si CI pasa.
- **Major de cualquier dependencia**: PR manual, ADR si afecta a la criptografía o autenticación.
- **CVE high/critical**: PR de remediación con prioridad sobre la fase en curso.
