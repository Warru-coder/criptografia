# 0.1 — Branch `security/remediation` + Tag `pre-audit-v0.3.0`

## Por qué

Antes de modificar criptografía o autenticación, hay que poder **volver al estado previo en un comando**. Sin tag, un `git reset` mal hecho puede borrar trabajo o dejar la rama en un estado intermedio no funcional.

## Comandos ejecutados

```powershell
# Punto de rollback inmutable apuntando al último commit estable (3af01a1)
git tag pre-audit-v0.3.0

# Branch dedicado para todo el trabajo de remediación
git checkout -b security/remediation
```

## Verificación

```powershell
PS> git branch --show-current
security/remediation

PS> git tag --list "pre-audit*"
pre-audit-v0.3.0

PS> git rev-parse pre-audit-v0.3.0
3af01a1...
```

## Cómo revertir TODA la auditoría si es necesario

```powershell
git checkout main
git branch -D security/remediation     # opcional, borra el trabajo
git reset --hard pre-audit-v0.3.0      # ⚠️ destructivo — solo si quieres descartar
```

## Política durante la remediación

- **Cada fase** termina con un commit firmado y un tag intermedio: `phase-0-complete`, `phase-1-complete`, etc.
- **Merge a `main` solo cuando** una fase está cerrada Y los criterios de salida documentados se cumplen.
- **Force push prohibido** en `security/remediation` una vez compartido en remoto.
