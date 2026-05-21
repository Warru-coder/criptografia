---
name: security-audit
description: Use when performing a security audit, pre-release check, or code review of SecureCrypt. Triggers on: security audit, check security, pre-release review, vulnerability scan, crypto review. Use ONLY when explicitly asked to audit security or review code for vulnerabilities.
---

# Security Audit Checklist

## Quick Audit Commands

```bash
# Run all checks
npm run build && npm run test && npm run lint && npm audit

# Check for hardcoded secrets
rg -i "(password|secret|api_key|token)\s*=\s*['\"]" src/

# Check for console.log of sensitive data
rg "console\.(log|info)" src/ | rg -i "(password|key|secret|token)"

# Find any use of insecure crypto algorithms
rg "(ecb|des|rc4|md5|sha1)" src/ --type ts
```

## Critical Checks (Must Pass)

### 1. No Hardcoded Secrets
Search for any hardcoded passwords, keys, or tokens in `src/`.

### 2. No Insecure Algorithms
Verify NO usage of:
- AES-ECB (pattern: `createCipheriv.*ecb`)
- DES/3DES
- RC4
- MD5 for hashing
- SHA1 for hashing

### 3. Unique IV/Salt Per Operation
Every encryption call must generate fresh `crypto.randomBytes(16)`.

### 4. Passwords Never Stored Plaintext
Only Argon2id hashes in `vault/master.hash`.

### 5. Memory Cleanup
All derived keys must be zeroed: `Buffer.fill(0)`.

### 6. System Files Excluded
Check `src/filesystem/systemExclusions.ts` covers all critical Windows paths.

### 7. Input Validation
All file paths validated, no path traversal possible.

### 8. Stream Safety
No `fs.readFileSync` for large files. All crypto uses streaming.

### 9. Error Messages Safe
No sensitive data in error messages (no keys, passwords, full paths).

### 10. Tests Pass
All tests must pass: `npm run test`

## Report Format

```
## Security Audit — [date]

| Check | Status | Notes |
|---|---|---|
| No hardcoded secrets | PASS/FAIL | |
| No insecure algorithms | PASS/FAIL | |
| Unique IV/salt | PASS/FAIL | |
| Passwords hashed | PASS/FAIL | |
| Memory cleanup | PASS/FAIL | |
| System exclusions | PASS/FAIL | |
| Input validation | PASS/FAIL | |
| Stream safety | PASS/FAIL | |
| Safe error messages | PASS/FAIL | |
| All tests pass | PASS/FAIL | |

### Issues Found
[Detailed list with file:line references]
```
