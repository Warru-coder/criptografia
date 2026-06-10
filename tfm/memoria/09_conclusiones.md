# Capítulo 9: Conclusiones y Trabajo Futuro

## 9.1 Conclusiones

### 9.1.1 Sobre los objetivos planteados

**OBJ-01 (Cifrado conforme a estándares)**: Cumplido. La implementación AES-256-GCM con Argon2id (memoryCost=65536 KB, timeCost=3, parallelism=2) supera los parámetros mínimos OWASP 2024. El análisis de seguridad confirma que no existen vulnerabilidades CVSS ≥ 7.0 no mitigadas en el sistema de cifrado.

**OBJ-02 (Arquitectura web-first)**: Cumplido. La interfaz web proporciona funcionalidad completa de cifrado/descifrado de archivos e integración con el asistente IA, accesible desde cualquier navegador moderno sin instalación adicional.

**OBJ-03 (Seguridad de la implementación)**: Cumplido. Se identificaron y corrigieron 10 vulnerabilidades, incluyendo path traversal (CVSS 8.1), password-in-body (CVSS 7.3) y salt fijo en C++ (CVSS 8.8). El proceso de corrección está completamente documentado con PoC y referencias normativas.

**OBJ-04 (Asistente IA local)**: Cumplido. El sistema RAG con base de conocimiento de 15 chunks NIST/OWASP funciona sin conexión a internet, con fallback determinista al modo template cuando Ollama no está disponible.

**OBJ-05 (Auditor de configuración)**: Cumplido. 9 reglas NIST/OWASP detectan configuraciones inseguras con una puntuación de riesgo ponderada por severidad.

**OBJ-06 (Multiplataforma)**: Parcialmente cumplido. La app Windows (C++) es funcional con las correcciones de Fase 0. La app Android está planificada para Fase 2.

### 9.1.2 Aportaciones académicas

1. **Metodología de auditoría criptográfica automática**: La formalización de reglas NIST/OWASP como sistema de detección puede ser adoptada por herramientas de análisis estático de código (SAST) o pipelines CI/CD para verificación automática de configuraciones criptográficas.

2. **RAG especializado sin dependencias cloud**: La arquitectura propuesta (base de conocimiento estructurada + recuperación keyword + LLM local) es reproducible para cualquier dominio técnico especializado donde la privacidad de las consultas sea un requisito.

3. **Análisis sistemático de vulnerabilidades en implementaciones reales**: El proceso de identificación → CVSS → PoC → corrección → verificación proporciona un marco replicable para auditorías de seguridad de proyectos de software de tamaño medio.

### 9.1.3 Lecciones aprendidas

**Sobre criptografía**: La correcta implementación de AES-GCM requiere atención especial al tag de autenticación. Un sistema que descifra sin verificar el tag es equivalente a no tener autenticación. El diseño de streaming con tag al final es la mayor complejidad de implementación del proyecto.

**Sobre seguridad en C++**: La gestión manual de memoria introduce clases de vulnerabilidades (salt fijo, deadlock, timing attack) que en entornos managed (TypeScript/Java/Go) se evitan automáticamente. La port a Node.js del sistema de autenticación fue significativamente más robusta por defecto.

**Sobre IA para criptografía**: Los LLMs sin RAG tienden a dar recomendaciones "generalmente correctas pero específicamente desactualizadas" (ej. bcrypt en lugar de Argon2id, 100.000 iteraciones PBKDF2 en lugar de 600.000). El RAG con fuentes verificadas es esencial para un dominio donde los estándares evolucionan.

## 9.2 Trabajo futuro

### Fase 2 (Corto plazo — 6 meses)

- **Autenticación FIDO2/WebAuthn**: Eliminar la dependencia de contraseñas para usuarios web
- **Cifrado asimétrico**: Soporte X25519 + ChaCha20-Poly1305 para intercambio seguro entre usuarios
- **App Android**: Completar el adaptador Android con Kotlin/Jetpack Compose + módulo JNI de cifrado
- **RAG semántico**: Reemplazar TF-IDF por embeddings vectoriales (all-MiniLM-L6-v2) para búsqueda semántica
- **Cobertura de tests al 90%**: Completar tests de integración para todos los endpoints REST

### Fase 3 (Medio plazo — 12 meses)

- **Modo colaborativo**: Cifrado de archivos compartidos con múltiples destinatarios (clave de sesión cifrada para cada destinatario con su clave pública)
- **Extensión VS Code**: Auditor de configuración integrado en el IDE, con análisis en tiempo real
- **API pública**: Documentación OpenAPI 3.0, SDK para Python/JavaScript
- **Soporte macOS**: App nativa con Swift/AppKit

### Fase 4 (Largo plazo — SaaS)

- **Modelo SaaS freemium**: Plan gratuito (5GB, 3 usuarios) + Plan Pro ($9/mes) + Plan Enterprise
- **Sincronización cloud E2E**: Almacenamiento cifrado en S3/GCS donde el servidor nunca ve las claves
- **Cumplimiento SOC 2 Type II**: Auditoría independiente para mercado enterprise
- **Soporte post-cuántico**: Integración de ML-KEM (antes Kyber, seleccionado por NIST en 2024) para las operaciones de encapsulación de claves

## 9.3 Reflexión final

SecureCrypt demuestra que es posible construir una herramienta de cifrado de archivos conforme a los estándares de seguridad más exigentes sin sacrificar usabilidad. La combinación de una interfaz web accesible con criptografía de grado militar (AES-256-GCM + Argon2id) y un asistente inteligente que reduce la barrera de entrada al dominio criptográfico representa una propuesta de valor diferenciada en el mercado actual.

El proyecto también ilustra los riesgos de las implementaciones criptográficas "caseras": la versión original contenía 10 vulnerabilidades de seguridad, incluyendo un salt fijo que habría comprometido todas las contraseñas de usuario. La corrección sistemática de estas vulnerabilidades, documentada con rigor académico, constituye la aportación más directamente útil del trabajo.
