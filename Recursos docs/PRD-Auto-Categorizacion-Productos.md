# PRD — Auto-Categorización de Productos por Nombre (`vw_dwpproducto_categorizados`)

## Problem Statement

Un cliente (`empkey=1415`) tiene más de 2000 productos en producción con el campo `dwpn4catcod = 'PorCategorizar4'` — un valor de relleno que indica que los productos nunca fueron categorizados correctamente en el POS. Al activar el modo 2 del parámetro `DashboardTopMode` (gráfico top-categorías), el pie chart muestra una sola barra sin valor analítico, inutilizando la funcionalidad para este cliente. El cliente no puede corregir la categorización en el POS de forma autónoma.

El problema no es exclusivo de este cliente: otros clientes pueden tener valores "basura" en `dwpn4catcod` (NULL, vacío, variantes de "PorCategorizar", nodos fallback del árbol de categorías). La solución debe ser universal.

## Solution

Crear una PostgreSQL VIEW (`vw_dwpproducto_categorizados`) sobre la tabla `dwpproducto` que calcula automáticamente la categoría correcta (Nivel 4 del árbol de categorías estándar de AndesPOS) a partir del nombre del producto (`dwpproductodescripcion`), usando reglas `ILIKE`. La VIEW expone la misma columna `dwpn4catcod` con el valor corregido, de modo que el servicio `top-categories` solo necesita apuntar a la VIEW en lugar de la tabla directamente. Los productos que no califiquen para ninguna regla se muestran como `'Sin Categoría'`.

La VIEW respeta categorías ya válidas (pass-through) y solo aplica las reglas ILIKE cuando el valor actual sea "basura".

## User Stories

1. Como analista de negocios, quiero ver el gráfico de top-categorías con categorías reales, para tomar decisiones sobre el mix de productos.
2. Como analista, quiero que "Sin Categoría" aparezca como último slice en gris, para identificar qué productos aún necesitan ser clasificados.
3. Como administrador del dashboard, quiero que la categorización sea automática y se aplique a productos nuevos sin intervención manual, para no tener que reejecutar scripts periódicamente.
4. Como administrador, quiero que la solución no afecte a clientes que ya tienen categorías válidas en `dwpn4catcod`, para evitar regresiones.
5. Como administrador, quiero que la solución sea universal (no atada a `empkey=1415`), para que cualquier cliente con datos mal categorizados se beneficie.
6. Como DBA, quiero recibir un script SQL listo para ejecutar que cree la VIEW, para aplicarlo a producción sin modificar código de aplicación.
7. Como desarrollador, quiero que el cambio en el servicio sea mínimo (solo cambiar el nombre de la tabla en la query), para reducir el riesgo de regresión.
8. Como usuario final, quiero que el gráfico de torta muestre categorías descriptivas en español (ej: "Conservas de Mar", "Pastas"), para entender los resultados sin conocimiento técnico.

## Implementation Decisions

### 1. VIEW en la misma DB que el POS/DW

La DB del dashboard backend es la misma que contiene `dwpproducto`. La VIEW se crea ahí directamente. No se requiere tabla auxiliar ni sincronización entre bases de datos.

### 2. La VIEW expone el mismo nombre de columna `dwpn4catcod`

La VIEW se llama `vw_dwpproducto_categorizados` y expone exactamente las mismas columnas que `dwpproducto` (`dwpempkey`, `dwpproductokey`, `dwpproductodescripcion`, `dwpn4catcod`), pero con `dwpn4catcod` calculado. El servicio solo cambia `FROM dwpproducto` → `FROM vw_dwpproducto_categorizados`. No se renombran columnas ni se cambian tipos.

### 3. Lógica de pass-through para categorías válidas

La primera condición del `CASE` preserva el valor original cuando ya es válido:

```
Si dwpn4catcod NO es NULL
   Y NO está vacío
   Y NO termina en 'Otr'        -- nodos fallback del árbol AndesPOS
   Y NO empieza con 'PorCategorizar'  -- valor específico de este cliente
→ THEN TRIM(dwpn4catcod)  (pasa sin cambios)
```

**Pendiente validar con DBA:** revisar qué otros valores "basura" existen en producción para otros clientes (ej: strings tipo `'0'`, `'NULL'`, variantes de SinClasif) y ampliar la condición antes del deploy final.

### 4. Reglas ILIKE por categoría Nivel 4 del árbol AndesPOS

Las reglas se generaron a partir del CSV de 2000+ productos (`empkey=1415`) cruzado con el árbol de categorías estándar. El valor que retorna cada regla es la `CATEGORIAPRODUCTODESCRIPCION` del nodo Nivel 4 correspondiente.

**Árbol cubierto (Nivel 4 → descripción exacta):**

| ID árbol | Descripción (valor retornado) |
|---|---|
| Pastas | `Pastas` |
| GraLegCer | `Granos Legumbres y Cereales` |
| AzuEndul | `Azucares y Endulzantes` |
| MermMiel | `Mermeladas Miel y Otros` |
| Harinas | `Harinas` |
| AlimAceites | `Aceites de Cocina` |
| Condimento | `Condimentos` |
| AderSalsa | `Aderezos y Salsas` |
| ConserMar | `Conservas de Mar` |
| SopCaldCrem | `Sopas Caldos y Cremas` |
| ConserFrut | `Conservas de Frutas` |
| ConserVerd | `Conservas de Verduras` |
| CarnRoj | `Carnes rojas vacuno cerdo` |
| Aves | `Aves pollo pavo` |
| PescMarisco | `Pescados y mariscos` |
| FiambCharc | `Fiambres y Charcuteria` |
| Cafe | `Cafe` |
| Te | `Te` |
| Mate | `Mate` |
| Hierbas | `Hierbas` |
| FeculPolv | `Feculas y Polvos` |
| LechConEva | `Leche Condensa y Evaporada` |
| Esencias | `Esencias` |
| Cremas | `Cremas` |
| ColadPicad | `Colados y Picados` |
| Yoghurts | `Yoghurts` |
| PostLact | `Postres Lacteos` |
| Ques | `Quesos` |
| QuesMad | `Quesos Maduros` |
| QuesRallads | `Quesos Rallados` |
| MantMarg | `Mantequillas y Margarinas` |
| Huevos | `Huevos` |
| LechEsp | `Leches especiales` |
| LechSabBebLact | `Leches Saborizadas y Bebidas Lacteas` |
| LechLiq | `Leches liquidas` |
| ComPrep | `Comidas preparadas` |
| VerdFrutCong | `Verduras y frutas congeladas` |
| PrepCarn | `Preparados carnicos` |
| VerdHortal | `Verduras y Hortalizas` |
| SnacksSaladFrutSec | `Snacks Salados y Frutos Secos` |
| GalletColac | `Galletas y Colaciones` |
| ChocolDulcCaram | `Chocolates Dulces y Caramelos` |
| BarrasCereal | `Barras de Cereal` |
| JugosPolvo | `Jugos en Polvo` |
| JugosNectar | `Jugos y Nectares` |
| AguasSabor | `Aguas Saborizadas` |
| AguasMineral | `Aguas Minerales o Purificadas` |
| GaseosaReg | `Gaseosas Regulares` |
| GaseosasLightZero | `Gaseosas Light y Zero` |
| Energeticas | `Energeticas` |
| Isotonicas | `Isotonicas` |
| Cervezas | `Cervezas` |
| VinosFermen | `Vinos y Fermentados` |
| Destilados | `Destilados` |
| LicoresAperitivos | `Licores y Aperitivos` |
| PstaCpsDnts | `Pasta y Cepillos de Dientes` |
| DesodAntitras | `Desodorantes y Antitraspirantes` |
| ShmpAcndr | `Shampoo y Acondicionador` |
| Jabones | `Jabones` |
| AfeitDepil | `Afeitado y Depilacion` |
| ToallasHigie | `Toallas Higienicas` |
| Cloro | `Cloro` |
| DetergMultiuso | `Detergentes y Multiuso` |
| LavalozaLava | `Lavalozas y Lavavajillas` |
| Multiusos | `Multiusos` |
| LimpBao | `Limpiadores de Baño` |
| LimpPisos | `Limpiador de pisos` |
| CeraVirut | `Cera y Virutilla` |
| Escobillones | `Escobillones` |
| PanosMopas | `Paños y Mopas` |
| EsponjasGuantes | `Esponjas y Guantes` |
| Aerosoles | `Aerosoles` |
| PapelHigie | `Papel Higienico` |
| Servilletas | `Servilletas` |
| ToallasPapel | `Toallas de Papel` |
| AluminioFilm | `Papel Aluminio y Film` |
| ToallasHumds | `Toallas Humedas` |
| BolsasMultiuso | `Bolsas Multiuso` |
| Insecticidas | `Insecticidas` |
| AlcoholGelMasc | `Alcohol Gel y Mascarillas` |
| Cigarrillos20 | `Cigarrillos Cajetilla de 20` |
| Ence | `Encendedores` |
| Pilas | `Pilas` |

**Reglas de ordenamiento crítico dentro del CASE:**
- "Leches especiales" y "Leches Saborizadas" van ANTES que `LECHE` genérico
- "Carnes rojas" y "Aves" van ANTES que "Preparados carnicos" (catch-all de hamburguesas/nuggets)
- `PASTA DENTAL` excluido explícitamente de `Pastas`
- `PASTA CHOCLO` (congelado) excluido de `Pastas`
- `LECHE CON AVENA` (saborizada) excluido del genérico de granos
- `CREMA PEINAR` / `CREMA PARA PAINAR` va a `Shampoo y Acondicionador`, no a `Cremas`
- Mascarillas capilares (FRUCTIS, ELVIVE, PANTENE) van a `Shampoo y Acondicionador`; mascarillas faciales/sanitarias van a `Alcohol Gel y Mascarillas`

### 5. Fallback: `'Sin Categoría'`

Productos que no calzan con ninguna regla retornan `'Sin Categoría'`. Esto es deliberado: el slice visible en el gráfico actúa como feedback al cliente sobre datos incompletos.

**Pendiente validar con senior developer:** si conviene usar en su lugar el valor `'No clasificable en Otro Departamento'` del árbol (nodo `DepOtrOtrOtr`), para respetar la jerarquía. Por ahora se usa `'Sin Categoría'`.

### 6. Entrega: script SQL para DBA

El artefacto principal es `backend/sql/vw_dwpproducto_categorizados.sql` — un archivo `CREATE OR REPLACE VIEW` que el DBA ejecuta manualmente en la DB de producción. No es una migración TypeORM ni un script npm.

El archivo se versiona en el repositorio bajo `backend/sql/`.

### 7. Cambio en el servicio backend

Solo `top-categories.service.ts` requiere modificación: cambiar `FROM dwpproducto` por `FROM vw_dwpproducto_categorizados` en la query principal. Sin cambios en parámetros, respuesta, ni ningún otro servicio.

### 8. Cambio en el frontend: `'Sin Categoría'` en gris y último

`TopCategoriesChart.tsx` debe:
- Detectar el slice `'Sin Categoría'` y asignarle color gris (fuera de la paleta de colores del chart)
- Ordenar los datos para que `'Sin Categoría'` siempre sea el último slice

---

## SQL Entregable (VIEW completa)

```sql
-- =============================================================
-- VIEW: vw_dwpproducto_categorizados
-- Propósito: Calcular dwpn4catcod a partir del nombre del producto
--            cuando el valor actual es inválido/basura.
-- Árbol de referencia: BASE Categorías 2606 AndesPOS
-- Generado: 2026-06-10
-- PENDIENTE: revisar valores "basura" adicionales en prod (ver sección 3)
-- =============================================================
CREATE OR REPLACE VIEW vw_dwpproducto_categorizados AS
SELECT
  dwpempkey,
  dwpproductokey,
  dwpproductodescripcion,
  CASE
    -- -------------------------------------------------------
    -- PASS-THROUGH: categoría ya válida → respetar sin cambios
    -- -------------------------------------------------------
    WHEN dwpn4catcod IS NOT NULL
      AND TRIM(dwpn4catcod) <> ''
      AND dwpn4catcod NOT ILIKE 'PorCategorizar%'
      AND dwpn4catcod NOT ILIKE '%Otr'
    THEN TRIM(dwpn4catcod)

    -- -------------------------------------------------------
    -- LACTEOS (orden específico antes de genérico LECHE)
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%LECHE SIN LACTOSA%'
      OR dwpproductodescripcion ILIKE '%LECHE 0 LACTO%'
      OR dwpproductodescripcion ILIKE '%LECHE NIDO%'
      OR dwpproductodescripcion ILIKE '%LECHE ESPECIAL%'
    THEN 'Leches especiales'

    WHEN dwpproductodescripcion ILIKE '%LECHE CONDENSADA%'
      OR dwpproductodescripcion ILIKE '%LECHE EVAPORADA%'
      OR dwpproductodescripcion ILIKE '%LECHE COND%'
    THEN 'Leche Condensa y Evaporada'

    WHEN dwpproductodescripcion ILIKE '%LECHE CHOCOLATE%'
      OR dwpproductodescripcion ILIKE '%LECHE FRUTILLA%'
      OR dwpproductodescripcion ILIKE '%LECHE VAINILLA%'
      OR dwpproductodescripcion ILIKE '%LECHE COLUN 200ML%'
      OR dwpproductodescripcion ILIKE '%LECHE SURLAT 200ML%'
      OR dwpproductodescripcion ILIKE '%LECHE COOKIES%'
      OR dwpproductodescripcion ILIKE '%LECHE CON AVENA%'
      OR dwpproductodescripcion ILIKE '%LECHE PROTEIN%'
      OR dwpproductodescripcion ILIKE '%REQUETEPATITAS%'
      OR dwpproductodescripcion ILIKE '%LECHE CHOCO%'
      OR dwpproductodescripcion ILIKE '%PACK LECHE%'
    THEN 'Leches Saborizadas y Bebidas Lacteas'

    -- -------------------------------------------------------
    -- DESPENSA
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%SPAGHETTI%'
      OR dwpproductodescripcion ILIKE '%CORBATITA%'
      OR dwpproductodescripcion ILIKE '%CORBATA%'
      OR dwpproductodescripcion ILIKE '%CABELLITO%'
      OR dwpproductodescripcion ILIKE '%CANUTO%'
      OR dwpproductodescripcion ILIKE '%CARACOL%'
      OR dwpproductodescripcion ILIKE '%ESPIRAL%'
      OR dwpproductodescripcion ILIKE '%LASAÑA%'
      OR dwpproductodescripcion ILIKE '%TALLAR%'
      OR dwpproductodescripcion ILIKE '%MOSTACHOL%'
      OR dwpproductodescripcion ILIKE '%RIGATONI%'
      OR dwpproductodescripcion ILIKE '%QUIFARO%'
      OR dwpproductodescripcion ILIKE '%PENNE%'
      OR dwpproductodescripcion ILIKE '%ROTINI%'
      OR dwpproductodescripcion ILIKE '%FIDEO%'
      OR (dwpproductodescripcion ILIKE '%PASTA%'
          AND dwpproductodescripcion NOT ILIKE '%PASTA DENTAL%'
          AND dwpproductodescripcion NOT ILIKE '%PASTA DENT%'
          AND dwpproductodescripcion NOT ILIKE '%PASTA FRESC%'
          AND dwpproductodescripcion NOT ILIKE '%PASTA CHOCLO%'
          AND dwpproductodescripcion NOT ILIKE '%PASTA TOMAT%')
    THEN 'Pastas'

    WHEN dwpproductodescripcion ILIKE '%ARROZ%'
      OR dwpproductodescripcion ILIKE '%GARBANZO%'
      OR dwpproductodescripcion ILIKE '%LENTEJA%'
      OR dwpproductodescripcion ILIKE '%QUINOA%'
      OR dwpproductodescripcion ILIKE '%CENTENO%'
      OR (dwpproductodescripcion ILIKE '%AVENA%'
          AND dwpproductodescripcion NOT ILIKE '%LECHE CON AVENA%')
      OR (dwpproductodescripcion ILIKE '%POROTO%'
          AND dwpproductodescripcion NOT ILIKE '%POROTO VERDE%'
          AND dwpproductodescripcion NOT ILIKE '%POROTO CORTE%')
    THEN 'Granos Legumbres y Cereales'

    WHEN dwpproductodescripcion ILIKE '%AZUCAR%'
      OR dwpproductodescripcion ILIKE '%AZÚCAR%'
      OR dwpproductodescripcion ILIKE '%STEVIA%'
      OR dwpproductodescripcion ILIKE '%ENDULZANTE%'
      OR dwpproductodescripcion ILIKE '%SUCRALOSA%'
    THEN 'Azucares y Endulzantes'

    WHEN dwpproductodescripcion ILIKE '%MERMELADA%'
      OR dwpproductodescripcion ILIKE '%MIEL%'
      OR dwpproductodescripcion ILIKE '%MANJAR%'
      OR dwpproductodescripcion ILIKE '%MANJARATE%'
    THEN 'Mermeladas Miel y Otros'

    WHEN dwpproductodescripcion ILIKE '%HARINA%'
      OR dwpproductodescripcion ILIKE '%LEVADURA%'
      OR (dwpproductodescripcion ILIKE '%SEMOLA%'
          AND dwpproductodescripcion NOT ILIKE '%SEMOLA SOPROLE%')
    THEN 'Harinas'

    -- -------------------------------------------------------
    -- ACEITES Y CONDIMENTOS
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%ACEITE%'
    THEN 'Aceites de Cocina'

    WHEN dwpproductodescripcion ILIKE '%MAYONESA%'
      OR dwpproductodescripcion ILIKE 'MAYO %'
      OR dwpproductodescripcion ILIKE '%KETCHUP%'
      OR dwpproductodescripcion ILIKE '%SALSA SOJA%'
      OR dwpproductodescripcion ILIKE '%SALSA SOJ%'
      OR dwpproductodescripcion ILIKE '%SALSA TUCCO%'
      OR dwpproductodescripcion ILIKE '%SALSA TOMATE%'
      OR dwpproductodescripcion ILIKE '%MOSTAZA%'
      OR dwpproductodescripcion ILIKE '%SOFRITO%'
      OR dwpproductodescripcion ILIKE '%ADEREZO%'
    THEN 'Aderezos y Salsas'

    WHEN dwpproductodescripcion ILIKE '%PIMIENTA%'
      OR dwpproductodescripcion ILIKE '%COMINO%'
      OR dwpproductodescripcion ILIKE '%OREGANO%'
      OR dwpproductodescripcion ILIKE '%CANELA%'
      OR dwpproductodescripcion ILIKE '%CLAVO%'
      OR dwpproductodescripcion ILIKE '%CURRY%'
      OR dwpproductodescripcion ILIKE '%CIBOULETTE%'
      OR dwpproductodescripcion ILIKE '%JENJIBRE%'
      OR dwpproductodescripcion ILIKE '%JENGIBRE%'
      OR dwpproductodescripcion ILIKE '%AJO EN POLVO%'
      OR dwpproductodescripcion ILIKE '%PAPRIKA%'
      OR dwpproductodescripcion ILIKE '%LAUREL%'
      OR dwpproductodescripcion ILIKE '%MERKEN%'
      OR dwpproductodescripcion ILIKE '%MERKÉN%'
      OR (dwpproductodescripcion ILIKE '% SAL %' AND dwpproductodescripcion NOT ILIKE '%SALSA%')
      OR dwpproductodescripcion ILIKE 'SAL %'
    THEN 'Condimentos'

    -- -------------------------------------------------------
    -- CONSERVAS
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%ATUN%'
      OR dwpproductodescripcion ILIKE '%JUREL%'
      OR dwpproductodescripcion ILIKE '%CHORITO%'
      OR dwpproductodescripcion ILIKE '%PAILA MARINA%'
      OR dwpproductodescripcion ILIKE '%SARDINA%'
      OR dwpproductodescripcion ILIKE '%ANCHOVETA%'
      OR dwpproductodescripcion ILIKE '%PALMITO%'
      OR (dwpproductodescripcion ILIKE '%SALMON%'
          AND dwpproductodescripcion NOT ILIKE '%NUGGET%'
          AND dwpproductodescripcion NOT ILIKE '%CROQUETA%')
    THEN 'Conservas de Mar'

    WHEN dwpproductodescripcion ILIKE '%SOPA %'
      OR dwpproductodescripcion ILIKE '% SOPA%'
      OR dwpproductodescripcion ILIKE '%CALDO %'
      OR dwpproductodescripcion ILIKE '%CALDILLO%'
      OR dwpproductodescripcion ILIKE '%RAMEN%'
      OR dwpproductodescripcion ILIKE '%MARUCHAN%'
    THEN 'Sopas Caldos y Cremas'

    WHEN dwpproductodescripcion ILIKE '%DURAZNO MITAD%'
      OR dwpproductodescripcion ILIKE '%DURAZNO CUBO%'
      OR dwpproductodescripcion ILIKE '%COCTEL DE FRUTA%'
      OR dwpproductodescripcion ILIKE '%CONSERVA FRUT%'
    THEN 'Conservas de Frutas'

    WHEN dwpproductodescripcion ILIKE '%CHAMPIÑON%'
      OR dwpproductodescripcion ILIKE '%CHAMPINON%'
      OR dwpproductodescripcion ILIKE '%POROTO VERDE%'
      OR dwpproductodescripcion ILIKE '%POROTO CORTE%'
      OR dwpproductodescripcion ILIKE '%ESPARRAG%'
    THEN 'Conservas de Verduras'

    -- -------------------------------------------------------
    -- CARNES Y PESCADOS (específico antes de Preparados carnicos)
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%NUGGET SALMON%'
      OR dwpproductodescripcion ILIKE '%CROQUETA SALMON%'
    THEN 'Pescados y mariscos'

    WHEN dwpproductodescripcion ILIKE '%JAMON%'
      OR dwpproductodescripcion ILIKE '%SALCHICHA%'
      OR dwpproductodescripcion ILIKE '%CARIOCA%'
      OR dwpproductodescripcion ILIKE '%SERRANITA%'
      OR dwpproductodescripcion ILIKE '%VIENESA%'
      OR dwpproductodescripcion ILIKE '%CECINA%'
      OR dwpproductodescripcion ILIKE '%MORTADELA%'
      OR dwpproductodescripcion ILIKE '%CHORIZO%'
    THEN 'Fiambres y Charcuteria'

    WHEN dwpproductodescripcion ILIKE '%CARNE MOLIDA%'
      OR dwpproductodescripcion ILIKE '%MALAYA%'
      OR dwpproductodescripcion ILIKE '%ALBONDIGA%'
      OR (dwpproductodescripcion ILIKE '%HAMBURGUESA%'
          AND (dwpproductodescripcion ILIKE '%VACUNO%' OR dwpproductodescripcion ILIKE '% VAC%' OR dwpproductodescripcion ILIKE '%KING KONG%'))
      OR (dwpproductodescripcion ILIKE '%CHURRASCO%'
          AND dwpproductodescripcion NOT ILIKE '%POLLO%'
          AND dwpproductodescripcion NOT ILIKE '%PECHUGA%')
    THEN 'Carnes rojas vacuno cerdo'

    WHEN dwpproductodescripcion ILIKE '%PECHUGA POLLO%'
      OR dwpproductodescripcion ILIKE '%FILETE PECHUGA%'
      OR dwpproductodescripcion ILIKE '%NUGGET POLLO%'
      OR dwpproductodescripcion ILIKE '%CROQUETA POLLO%'
      OR dwpproductodescripcion ILIKE '%CROQUETA SUPER POLLO%'
      OR dwpproductodescripcion ILIKE '%CROCANTE POLLO%'
      OR dwpproductodescripcion ILIKE '%HAMBURGUESA POLLO%'
      OR dwpproductodescripcion ILIKE '%HAMBURGUESA MONTINA%'
      OR dwpproductodescripcion ILIKE '%TIRITAS PECHUGA%'
      OR dwpproductodescripcion ILIKE '%MOLIDA DE POLLO%'
      OR dwpproductodescripcion ILIKE '%ESCALOPA POLLO%'
      OR dwpproductodescripcion ILIKE '%POLLO CON MENUD%'
      OR dwpproductodescripcion ILIKE '%MEDALLITA PECHUGA%'
      OR dwpproductodescripcion ILIKE '%CHURRASCO PECHUGA%'
      OR dwpproductodescripcion ILIKE '%TRUTO%'
    THEN 'Aves pollo pavo'

    -- -------------------------------------------------------
    -- CAFE, TE Y HIERBAS
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%YERBA MATE%'
      OR dwpproductodescripcion ILIKE '%YERBA MATTE%'
    THEN 'Mate'

    WHEN dwpproductodescripcion ILIKE '% CAFE %'
      OR dwpproductodescripcion ILIKE 'CAFE %'
      OR dwpproductodescripcion ILIKE '%NESCAFE%'
      OR dwpproductodescripcion ILIKE '%CAFÉ%'
    THEN 'Cafe'

    WHEN dwpproductodescripcion ILIKE 'TE %'
      OR dwpproductodescripcion ILIKE '% TE %'
      OR dwpproductodescripcion ILIKE '%BOLSITAS%'
      OR dwpproductodescripcion ILIKE '%TE MINUTE%'
      OR dwpproductodescripcion ILIKE '%TE SUPREMO%'
      OR dwpproductodescripcion ILIKE '%TEA VERDE%'
      OR dwpproductodescripcion ILIKE '%TEA %'
    THEN 'Te'

    -- -------------------------------------------------------
    -- REPOSTERIA (específico antes de genérico)
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%ESENCIA VAINILLA%'
      OR dwpproductodescripcion ILIKE '%ESENCIA ALMENDRA%'
      OR (dwpproductodescripcion ILIKE '%ESENCIA%'
          AND dwpproductodescripcion NOT ILIKE '%ESENCIA CORP%')
    THEN 'Esencias'

    WHEN dwpproductodescripcion ILIKE '%CREMA PARA BATIR%'
      OR dwpproductodescripcion ILIKE '%CREMA ESPESA%'
      OR (dwpproductodescripcion ILIKE '%CREMA%' AND dwpproductodescripcion ILIKE '%BATIR%')
    THEN 'Cremas'

    WHEN dwpproductodescripcion ILIKE '%ALMIDON%'
      OR dwpproductodescripcion ILIKE '%MAIZENA%'
      OR dwpproductodescripcion ILIKE '%CACAO%'
      OR dwpproductodescripcion ILIKE '%PURE PAPA%'
    THEN 'Feculas y Polvos'

    -- -------------------------------------------------------
    -- ALIMENTACION INFANTIL
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%COMPOTA%'
      OR dwpproductodescripcion ILIKE '%SEMOLA SOPROLE%'
      OR dwpproductodescripcion ILIKE '%COLADO%'
    THEN 'Colados y Picados'

    -- -------------------------------------------------------
    -- LACTEOS CONTINUACION
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%YOGURT%'
      OR dwpproductodescripcion ILIKE '%YOGHURT%'
      OR dwpproductodescripcion ILIKE '%YOGHITO%'
      OR dwpproductodescripcion ILIKE '%YOGUITO%'
      OR (dwpproductodescripcion ILIKE '%UNO AL DIA%' AND dwpproductodescripcion ILIKE '%SOPROLE%')
    THEN 'Yoghurts'

    WHEN dwpproductodescripcion ILIKE '%JALEA%'
      OR dwpproductodescripcion ILIKE '%FLAN%'
      OR (dwpproductodescripcion ILIKE '%1+1%' AND dwpproductodescripcion ILIKE '%SOPROLE%')
      OR dwpproductodescripcion ILIKE '%GOLD CHOCO%'
    THEN 'Postres Lacteos'

    WHEN dwpproductodescripcion ILIKE '%QUESO RALLADO%'
      OR dwpproductodescripcion ILIKE '%QUESO PARMESANO%'
    THEN 'Quesos Rallados'

    WHEN dwpproductodescripcion ILIKE '%QUESO GAUDA%'
      OR dwpproductodescripcion ILIKE '%QUESO GOUDA%'
      OR dwpproductodescripcion ILIKE '%QUESO MANTECOSO%'
      OR dwpproductodescripcion ILIKE '%QUESO CHANCO%'
    THEN 'Quesos Maduros'

    WHEN dwpproductodescripcion ILIKE '%QUESO%'
    THEN 'Quesos'

    WHEN dwpproductodescripcion ILIKE '%MANTEQUILLA%'
      OR dwpproductodescripcion ILIKE '%MANYEQUILLA%'
      OR dwpproductodescripcion ILIKE '%MARGARINA%'
    THEN 'Mantequillas y Margarinas'

    WHEN dwpproductodescripcion ILIKE '%HUEVO%'
      OR dwpproductodescripcion ILIKE '%CAJA HUEVO%'
    THEN 'Huevos'

    WHEN dwpproductodescripcion ILIKE '%LECHE%'
    THEN 'Leches liquidas'

    -- -------------------------------------------------------
    -- CONGELADOS
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%PIAZZA%'
      OR dwpproductodescripcion ILIKE '%PIZZA%'
    THEN 'Comidas preparadas'

    WHEN dwpproductodescripcion ILIKE '%CHOCLO%'
      OR dwpproductodescripcion ILIKE '%JARDINERA%'
      OR dwpproductodescripcion ILIKE '%PAPA PREFRITA%'
      OR dwpproductodescripcion ILIKE '%PAPA DUQUESA%'
      OR dwpproductodescripcion ILIKE '%PAPA CORTE%'
      OR dwpproductodescripcion ILIKE '%ARVEJA%'
      OR (dwpproductodescripcion ILIKE '%PRIMAVERA%' AND dwpproductodescripcion ILIKE '%MINUTO%')
    THEN 'Verduras y frutas congeladas'

    WHEN dwpproductodescripcion ILIKE '%NUGGET%'
      OR dwpproductodescripcion ILIKE '%CROQUETA%'
      OR dwpproductodescripcion ILIKE '%CROCANTE%'
      OR dwpproductodescripcion ILIKE '%HAMBURGUESA%'
      OR dwpproductodescripcion ILIKE '%CHURRASCO%'
    THEN 'Preparados carnicos'

    -- -------------------------------------------------------
    -- FRUTAS Y VERDURAS FRESCAS
    -- -------------------------------------------------------
    WHEN (dwpproductodescripcion ILIKE '%PAPA %' OR dwpproductodescripcion ILIKE 'PAPA %')
      AND dwpproductodescripcion NOT ILIKE '%PAPA KRYSPO%'
      AND dwpproductodescripcion NOT ILIKE '%PAPA DUQUESA%'
      AND dwpproductodescripcion NOT ILIKE '%PAPA PREFRITA%'
      AND dwpproductodescripcion NOT ILIKE '%PAPA CORTE%'
    THEN 'Verduras y Hortalizas'

    -- -------------------------------------------------------
    -- SNACKS Y CONFITERIA
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%LAYS%'
      OR dwpproductodescripcion ILIKE '%PAPA KRYSPO%'
      OR dwpproductodescripcion ILIKE '%PAPAS FRITAS%'
      OR dwpproductodescripcion ILIKE '%SODA LINE%'
      OR dwpproductodescripcion ILIKE '%DE TODITO%'
      OR dwpproductodescripcion ILIKE '%CHEETOS%'
    THEN 'Snacks Salados y Frutos Secos'

    WHEN dwpproductodescripcion ILIKE '%GALLETA%'
      OR dwpproductodescripcion ILIKE '%BISCUIT%'
      OR dwpproductodescripcion ILIKE '%TRITON%'
      OR dwpproductodescripcion ILIKE '%KRAQUEÑA%'
      OR dwpproductodescripcion ILIKE '%MUIBON%'
      OR dwpproductodescripcion ILIKE '%KUKY%'
      OR (dwpproductodescripcion ILIKE '%GALL%' AND dwpproductodescripcion NOT ILIKE '%GALLINA%')
    THEN 'Galletas y Colaciones'

    WHEN dwpproductodescripcion ILIKE '%CHOCOLATE%'
      OR dwpproductodescripcion ILIKE '%MILKA%'
      OR dwpproductodescripcion ILIKE '%NESQUIK%'
      OR (dwpproductodescripcion ILIKE '%CHOC %' AND dwpproductodescripcion NOT ILIKE '%LECHE CHOCOLATE%')
    THEN 'Chocolates Dulces y Caramelos'

    WHEN dwpproductodescripcion ILIKE '%CEREAL BAR%'
      OR dwpproductodescripcion ILIKE '%BARRA CEREAL%'
    THEN 'Barras de Cereal'

    -- -------------------------------------------------------
    -- BEBIDAS Y LICORES
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%ZUKO%'
      OR dwpproductodescripcion ILIKE '%LIVEAN%'
      OR dwpproductodescripcion ILIKE '%SPRIM%'
    THEN 'Jugos en Polvo'

    WHEN dwpproductodescripcion ILIKE '%NECTAR%'
      OR (dwpproductodescripcion ILIKE '%JUGO%'
          AND dwpproductodescripcion NOT ILIKE '%ZUKO%'
          AND dwpproductodescripcion NOT ILIKE '%LIVEAN%'
          AND dwpproductodescripcion NOT ILIKE '%SPRIM%')
    THEN 'Jugos y Nectares'

    WHEN dwpproductodescripcion ILIKE '%AGUA MAS%'
      OR dwpproductodescripcion ILIKE '%AGUA ALOE%'
      OR dwpproductodescripcion ILIKE '%AGUA SABORIZADA%'
    THEN 'Aguas Saborizadas'

    WHEN dwpproductodescripcion ILIKE '%AGUA MINERAL%'
      OR dwpproductodescripcion ILIKE '%CACHANTUN%'
      OR dwpproductodescripcion ILIKE '%AGUA PURA%'
    THEN 'Aguas Minerales o Purificadas'

    WHEN dwpproductodescripcion ILIKE '%RED BULL%'
      OR dwpproductodescripcion ILIKE '%SCORE%'
      OR dwpproductodescripcion ILIKE '%MONSTER%'
      OR dwpproductodescripcion ILIKE '%ENERGETICA%'
    THEN 'Energeticas'

    WHEN dwpproductodescripcion ILIKE '%GATORADE%'
      OR dwpproductodescripcion ILIKE '%POWERADE%'
      OR dwpproductodescripcion ILIKE '%ISOTONICA%'
    THEN 'Isotonicas'

    WHEN dwpproductodescripcion ILIKE '%CERVEZA%'
      OR dwpproductodescripcion ILIKE '%HEINEKEN%'
      OR dwpproductodescripcion ILIKE '%STELLA%'
    THEN 'Cervezas'

    WHEN dwpproductodescripcion ILIKE '%VINO%'
      OR dwpproductodescripcion ILIKE '%SIDRA%'
      OR dwpproductodescripcion ILIKE '%CHAMPAGNE%'
    THEN 'Vinos y Fermentados'

    WHEN dwpproductodescripcion ILIKE '%PISCO%'
      OR dwpproductodescripcion ILIKE '%WHISKY%'
      OR dwpproductodescripcion ILIKE '%VODKA%'
    THEN 'Destilados'

    WHEN dwpproductodescripcion ILIKE '%LICOR%'
      OR dwpproductodescripcion ILIKE '%APERITIVO%'
    THEN 'Licores y Aperitivos'

    WHEN dwpproductodescripcion ILIKE '%COCA COLA%'
      OR dwpproductodescripcion ILIKE '%PEPSI%'
      OR dwpproductodescripcion ILIKE '%SPRITE%'
      OR dwpproductodescripcion ILIKE '%FANTA%'
      OR dwpproductodescripcion ILIKE '%BILZ%'
      OR dwpproductodescripcion ILIKE '%CRUSH%'
      OR dwpproductodescripcion ILIKE '%GASEOSA%'
    THEN 'Gaseosas Regulares'

    -- -------------------------------------------------------
    -- CUIDADO PERSONAL
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%COLGATE%'
      OR dwpproductodescripcion ILIKE '%PASTA DENTAL%'
      OR dwpproductodescripcion ILIKE '%PASTA DENT%'
      OR dwpproductodescripcion ILIKE '%LISTERINE%'
      OR dwpproductodescripcion ILIKE '%ENJUAGUE BUCAL%'
      OR dwpproductodescripcion ILIKE '%LUMINOUS WHITE%'
      OR dwpproductodescripcion ILIKE '%PROALIVIO%'
      OR (dwpproductodescripcion ILIKE '%CEPILLO%' AND (dwpproductodescripcion ILIKE '%DIENT%' OR dwpproductodescripcion ILIKE '%NIÑO%'))
    THEN 'Pasta y Cepillos de Dientes'

    WHEN dwpproductodescripcion ILIKE '%REXONA%'
      OR dwpproductodescripcion ILIKE '%SPEED STICK%'
      OR dwpproductodescripcion ILIKE '%OLD SPICE%'
      OR dwpproductodescripcion ILIKE '%DOVE TONO%'
      OR dwpproductodescripcion ILIKE '%DOVE GO FRESH%'
      OR dwpproductodescripcion ILIKE '%DOVE MEN 150%'
      OR (dwpproductodescripcion ILIKE 'DEO %')
      OR (dwpproductodescripcion ILIKE '% DEO %' AND dwpproductodescripcion NOT ILIKE '%DEO AMBIENTAL%')
      OR (dwpproductodescripcion ILIKE '%AXE%' AND (dwpproductodescripcion ILIKE '%SPRAY%' OR dwpproductodescripcion ILIKE '%150ML%'))
      OR (dwpproductodescripcion ILIKE '%DES %' AND dwpproductodescripcion ILIKE '%BARRA%')
      OR (dwpproductodescripcion ILIKE '%DES %' AND dwpproductodescripcion ILIKE '%NIVEA%')
    THEN 'Desodorantes y Antitraspirantes'

    WHEN dwpproductodescripcion ILIKE '% SH %'
      OR dwpproductodescripcion ILIKE 'SH %'
      OR dwpproductodescripcion ILIKE '%SHAMPOO%'
      OR dwpproductodescripcion ILIKE '%ACONDICIONADOR%'
      OR (dwpproductodescripcion ILIKE '%ACOND %')
      OR dwpproductodescripcion ILIKE '%HEAD SHOULDERS%'
      OR dwpproductodescripcion ILIKE '%PANTENE%'
      OR dwpproductodescripcion ILIKE '%ELVIVE%'
      OR dwpproductodescripcion ILIKE '%FRUCTIS%'
      OR dwpproductodescripcion ILIKE '%SEDAL%'
      OR dwpproductodescripcion ILIKE '%TINTURA%'
      OR dwpproductodescripcion ILIKE '%KOLESTON%'
      OR dwpproductodescripcion ILIKE '%GEL FIJADOR%'
      OR dwpproductodescripcion ILIKE '%CREMA PEINAR%'
      OR dwpproductodescripcion ILIKE '%CREMA PARA PAINAR%'
      OR (dwpproductodescripcion ILIKE '%MASCARILLA%'
          AND (dwpproductodescripcion ILIKE '%FRUCTIS%'
            OR dwpproductodescripcion ILIKE '%ELVIVE%'
            OR dwpproductodescripcion ILIKE '%PANTENE%'))
    THEN 'Shampoo y Acondicionador'

    WHEN dwpproductodescripcion ILIKE '%JABON LIQUIDO%'
      OR dwpproductodescripcion ILIKE '%JABON LUX%'
      OR dwpproductodescripcion ILIKE '%JABON DOVE%'
      OR dwpproductodescripcion ILIKE '%JABON%'
    THEN 'Jabones'

    WHEN dwpproductodescripcion ILIKE '%GILLETTE%'
      OR dwpproductodescripcion ILIKE '%PRESTOBARBA%'
      OR dwpproductodescripcion ILIKE '%PRESTOB%'
      OR dwpproductodescripcion ILIKE '%MAQUINA AFEITAR%'
      OR dwpproductodescripcion ILIKE '%SCHICK%'
      OR dwpproductodescripcion ILIKE '%WILKINSON%'
      OR dwpproductodescripcion ILIKE '%GEMEX%'
    THEN 'Afeitado y Depilacion'

    WHEN dwpproductodescripcion ILIKE '%TAMPONES%'
      OR dwpproductodescripcion ILIKE '%SABANILLA HIGIECLIN%'
      OR dwpproductodescripcion ILIKE '%TOALLA HIGIENICA%'
    THEN 'Toallas Higienicas'

    -- -------------------------------------------------------
    -- LIMPIEZA Y ASEO
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%CLORO%'
      OR dwpproductodescripcion ILIKE '%CLORINDA%'
    THEN 'Cloro'

    WHEN dwpproductodescripcion ILIKE '%DETERGENTE%'
      OR (dwpproductodescripcion ILIKE '%OMO %')
      OR dwpproductodescripcion ILIKE 'OMO %'
      OR dwpproductodescripcion ILIKE '%VANISH%'
      OR dwpproductodescripcion ILIKE '%FUZOL%'
      OR dwpproductodescripcion ILIKE '%DOWNY%'
      OR (dwpproductodescripcion ILIKE '%COMFORT%'
          AND (dwpproductodescripcion ILIKE '%LT%' OR dwpproductodescripcion ILIKE '%ML%'))
    THEN 'Detergentes y Multiuso'

    WHEN dwpproductodescripcion ILIKE '%LAVALOZA%'
      OR dwpproductodescripcion ILIKE '%LAVAVAJILLA%'
      OR dwpproductodescripcion ILIKE '%QUIX%'
    THEN 'Lavalozas y Lavavajillas'

    WHEN dwpproductodescripcion ILIKE '%TABLETAS PARA INODORO%'
      OR dwpproductodescripcion ILIKE '%PASTILLA INODORO%'
      OR dwpproductodescripcion ILIKE '%GEL PARA BAÑO%'
      OR dwpproductodescripcion ILIKE '%PASTILLA ARON%'
      OR dwpproductodescripcion ILIKE '%TOILET CLEANER%'
      OR dwpproductodescripcion ILIKE '%LYSOFORM%'
    THEN 'Limpiadores de Baño'

    WHEN dwpproductodescripcion ILIKE '%LIMPIA PISOS%'
      OR dwpproductodescripcion ILIKE '%LIMPIAPISO%'
      OR dwpproductodescripcion ILIKE '%LIQUIDO PISO%'
      OR dwpproductodescripcion ILIKE '%LIMPIA PISO%'
    THEN 'Limpiador de pisos'

    WHEN dwpproductodescripcion ILIKE '%CERA BRILLI%'
      OR dwpproductodescripcion ILIKE '%VIRUTILLA%'
    THEN 'Cera y Virutilla'

    WHEN dwpproductodescripcion ILIKE '%ESCOBILLON%'
    THEN 'Escobillones'

    WHEN dwpproductodescripcion ILIKE '%TRAPERO%'
      OR dwpproductodescripcion ILIKE '%PAÑO MULTIUSO%'
      OR dwpproductodescripcion ILIKE '%PAÑO MICROFIBRA%'
      OR dwpproductodescripcion ILIKE '%PAÑO AMARILLO%'
      OR dwpproductodescripcion ILIKE '%PAÑO ESPONJA%'
    THEN 'Paños y Mopas'

    WHEN dwpproductodescripcion ILIKE '%ESPONJA%'
      OR dwpproductodescripcion ILIKE '%PULIDOR ACERO%'
      OR (dwpproductodescripcion ILIKE '%GUANTE%'
          AND (dwpproductodescripcion ILIKE '%AMARILLO%' OR dwpproductodescripcion ILIKE '%LIMPIEZA%'))
    THEN 'Esponjas y Guantes'

    WHEN dwpproductodescripcion ILIKE '%AEROSOL%'
      OR dwpproductodescripcion ILIKE '%POETT%'
      OR dwpproductodescripcion ILIKE '%AMBIENTADOR%'
      OR dwpproductodescripcion ILIKE '%AROMATIZANTE%'
      OR dwpproductodescripcion ILIKE '%DEO AMBIENTAL%'
      OR dwpproductodescripcion ILIKE '%WINNEX%'
      OR dwpproductodescripcion ILIKE '%SHOPNOW%'
    THEN 'Aerosoles'

    WHEN dwpproductodescripcion ILIKE '%DESENGRASANTE%'
      OR dwpproductodescripcion ILIKE '%LIMPIA VIDRIO%'
      OR dwpproductodescripcion ILIKE '%LIMPIAVIDRIO%'
      OR dwpproductodescripcion ILIKE '%DESINFECTANTE%'
      OR (dwpproductodescripcion ILIKE '%IGENIX%'
          AND dwpproductodescripcion NOT ILIKE '%AEROSOL%')
    THEN 'Multiusos'

    WHEN dwpproductodescripcion ILIKE '%PAPEL HIG%'
      OR dwpproductodescripcion ILIKE '%PAPEL HIGIEN%'
      OR dwpproductodescripcion ILIKE '%MANGA NOBLE%'
      OR dwpproductodescripcion ILIKE '%MANGA CONFORT%'
      OR dwpproductodescripcion ILIKE '%MANGA ELITE%'
      OR dwpproductodescripcion ILIKE '%NOBLE SUPER%'
      OR (dwpproductodescripcion ILIKE '%SCOTT%'
          AND (dwpproductodescripcion ILIKE '%ROLLO%' OR dwpproductodescripcion ILIKE '%MTS%' OR dwpproductodescripcion ILIKE '%PAPEL%'))
      OR (dwpproductodescripcion ILIKE '%CONFORT%'
          AND (dwpproductodescripcion ILIKE '%ROLLO%' OR dwpproductodescripcion ILIKE '%MTS%'))
    THEN 'Papel Higienico'

    WHEN dwpproductodescripcion ILIKE '%SERVILLETA%'
    THEN 'Servilletas'

    WHEN dwpproductodescripcion ILIKE '%TOALLA ELITE%'
      OR dwpproductodescripcion ILIKE '%TOALLA LIKE%'
      OR (dwpproductodescripcion ILIKE '%TOALLA%' AND dwpproductodescripcion ILIKE '%MTS%')
    THEN 'Toallas de Papel'

    WHEN dwpproductodescripcion ILIKE '%ALUMINIO%'
      OR dwpproductodescripcion ILIKE '%ALUSA%'
    THEN 'Papel Aluminio y Film'

    WHEN dwpproductodescripcion ILIKE '%TOALLITA HUMEDA%'
      OR dwpproductodescripcion ILIKE '%TOALLA HUMEDA%'
      OR dwpproductodescripcion ILIKE '%TOALLITA DESINFEC%'
    THEN 'Toallas Humedas'

    WHEN dwpproductodescripcion ILIKE '%BOLSA BASURA%'
      OR dwpproductodescripcion ILIKE '%BOLSA HERMETICA%'
      OR dwpproductodescripcion ILIKE '%BOLSA COMIDA%'
      OR dwpproductodescripcion ILIKE '%BOLSA CON ASA%'
      OR dwpproductodescripcion ILIKE '%BOLSA ECOLOGICA%'
    THEN 'Bolsas Multiuso'

    WHEN dwpproductodescripcion ILIKE '%ATRAPA MOSCAS%'
      OR dwpproductodescripcion ILIKE '%INSECTICIDA%'
    THEN 'Insecticidas'

    WHEN dwpproductodescripcion ILIKE '%ALCOHOL GEL%'
    THEN 'Alcohol Gel y Mascarillas'

    -- -------------------------------------------------------
    -- TABAQUERIA
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%CIGARR%'
    THEN 'Cigarrillos Cajetilla de 20'

    WHEN dwpproductodescripcion ILIKE '%ENCENDEDOR%'
      OR dwpproductodescripcion ILIKE '%CHISPERO%'
    THEN 'Encendedores'

    -- -------------------------------------------------------
    -- FERRETERIA
    -- -------------------------------------------------------
    WHEN dwpproductodescripcion ILIKE '%PILA%'
      OR dwpproductodescripcion ILIKE '%BATERIA%'
    THEN 'Pilas'

    -- -------------------------------------------------------
    -- FALLBACK
    -- -------------------------------------------------------
    ELSE 'Sin Categoría'
  END AS dwpn4catcod

FROM dwpproducto;
```

---

## Testing Decisions

Un buen test para este cambio verifica el **comportamiento externo del endpoint**, no los detalles de la query SQL.

### Qué testear

- `GET /api/charts/top-categories?empkey=1415&...` debe retornar al menos N categorías distintas (no solo 1).
- Si todos los productos tienen `dwpn4catcod = 'PorCategorizar4'`, el endpoint no debe devolver `'PorCategorizar4'` en ninguna categoría del resultado.
- El campo `'Sin Categoría'` puede aparecer, pero no debe ser la única categoría.
- Clientes con categorías válidas (otro `empkey` de test) no deben ver sus categorías alteradas por la VIEW.

### Módulos a testear

- `top-categories.service.ts` (spec existente en `src/charts/`): agregar test con fixture de productos "sin categoría" verificando que el resultado sea diverso.
- La VIEW en sí no requiere test unitario — es SQL puro validado manualmente por el DBA antes del deploy.

### Prior art

Los tests existentes en `src/charts/*.spec.ts` usan `empkey` únicos por test para evitar cache hits en `ChartCacheInterceptor`. Seguir el mismo patrón.

---

## Out of Scope

- UI para que el cliente gestione manualmente sus categorías.
- Drill-down de categorías (Nivel 3 → Nivel 4).
- Soporte para múltiples idiomas en los nombres de categoría.
- Sincronización automática con cambios en el árbol de categorías AndesPOS.
- Detección automática de productos "bien categorizados pero en categoría equivocada".
- Categorías que no aparecen en el CSV de muestra (ej: Pilas, Ferretería) — cobertura básica incluida, sin garantía de exhaustividad.

---

## Further Notes

- **Pendiente crítico pre-deploy:** revisar en producción qué valores "basura" existen en `dwpn4catcod` para empkeys distintos de 1415, y ampliar la condición de pass-through si es necesario. Query sugerida: `SELECT DISTINCT dwpn4catcod FROM dwpproducto ORDER BY 1`.
- **Pendiente validar con senior:** si `'Sin Categoría'` es el fallback correcto o si se debe usar el nodo `DepOtrOtrOtr` del árbol (`'No clasificable en Otro Departamento 4'`).
- **Frontend:** el slice `'Sin Categoría'` debe recibir color gris y ordenarse último. Esto requiere un pequeño ajuste en `TopCategoriesChart.tsx`.
- **Las reglas son vivas:** a medida que aparezcan nuevos tipos de producto, el DBA puede ejecutar `CREATE OR REPLACE VIEW` con reglas adicionales sin necesidad de redeploy del backend.
- **El archivo SQL vive en `backend/sql/vw_dwpproducto_categorizados.sql`** — versionado en el repo para reproducibilidad.
