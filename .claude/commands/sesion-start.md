---
description: Iniciar sesión del POS Dashboard. Lee el estado del proyecto, confirma contexto, lista pendientes priorizados y propone agenda.
---

# Inicio de Sesión — POS Dashboard

## Paso 1: Cargar fuentes de verdad

Lee ambos archivos **completos** antes de continuar:

1. `Recursos docs/ESTADO-DEPLOY-SESIONES-FUTURAS.md` — estado operativo, historial, pendientes, lecciones, contexto crítico
2. `CLAUDE.md` — arquitectura, convenciones, reglas de queries, workflow de skills

No asumas nada desde la memoria de conversación anterior. El ESTADO es la única fuente de verdad.

---

## Paso 2: Producir el briefing de sesión

Presenta al usuario un resumen estructurado con **exactamente estas secciones**, en español, conciso:

### 🗂 Estado del proyecto
Una tabla de 3 columnas (Componente | Estado | Nota clave) con solo los componentes relevantes:
- Los que tienen ⏳ o ❌ (pendientes / con problema)
- Los que cambiaron en la sesión más reciente (última entrada del historial)
- Omitir los ✅ estables que no generan acción

### 🔴 Pendientes prioritarios
Lista numerada de los ítems de alta prioridad que están abiertos. Para cada uno:
- Nombre del pendiente
- Archivo(s) afectado(s)
- Una línea de contexto: por qué importa o qué lo bloquea

### 🟡 Pendientes media prioridad
Lista breve. Si está bloqueado por algo externo, indicarlo.

### 🟢 Baja prioridad (referencia)
Solo los nombres, sin desarrollo.

### ⚠️ Riesgos activos
Cosas que pueden causar problema en la próxima sesión:
- Inconsistencias conocidas entre entornos (local vs QA)
- Reglas críticas que NO están en el código (contexto crítico del doc)
- Decisiones de diseño que tienen trampas conocidas

### 🐛 Bugs relevantes (referencia rápida)
Solo los bugs que tienen riesgo de reaparecer o que tienen una lección aplicable a trabajo futuro. Formato: síntoma → causa → solución en una línea cada uno.

### 📋 Historial reciente
Las últimas 2–3 sesiones del historial en una línea cada una. Orientar al usuario sobre dónde quedó el proyecto.

---

## Paso 3: Proponer agenda

Basándote en los pendientes prioritarios y el historial reciente, propone una agenda concreta de máximo 3 ítems para esta sesión. Ejemplo de formato:

```
Agenda sugerida:
  1. [ítem de alta prioridad] — archivo: X
  2. [ítem de media prioridad] — archivo: Y
  3. [ítem de baja prioridad si queda tiempo]

¿Confirmamos esta agenda o querés ajustar el orden?
```

---

## Reglas del briefing

- **No ejecutes código ni hagas cambios** en este paso — solo leer y reportar
- **No inventes estado** — si algo no está en el ESTADO, di que no está documentado
- Si hay contradicción entre CLAUDE.md y el ESTADO, señálala explícitamente
- Usa el mismo idioma del ESTADO (español)
- El briefing completo debe caber en una sola respuesta, sin truncar secciones
- Termina siempre con la pregunta: **"¿Arrancamos con esto o hay algo que querés cambiar?"**
