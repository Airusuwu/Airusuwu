# AFN-ε Designer + Lema de Arden (Vanilla JS)

Aplicación web sin framework para:

- Diseñar un **AFN-ε** gráficamente con **Cytoscape.js** (drag & drop).
- Editar estados, estado inicial, estados finales y transiciones (incluyendo `ε`).
- Importar/exportar definición del autómata en JSON.
- Ejecutar conversión **AFN-ε → AFN sin ε** mediante **ε-closure**.
- Construir y resolver el sistema de ecuaciones por **Lema de Arden**.
- Mostrar la **regex final** y una **bitácora paso a paso**.

## Ejecutar localmente

No requiere build tools.

```bash
python3 -m http.server 8000
```

Luego abre: `http://localhost:8000`

También puedes abrir `index.html` directamente, pero para evitar restricciones del navegador al importar/exportar archivos se recomienda usar servidor local.

## Uso rápido

1. Agrega estados con **+ Estado**.
2. Selecciona un nodo y usa **Marcar inicial**.
3. Selecciona uno o más nodos y usa **Toggle final**.
4. Selecciona 2 nodos (origen y destino) y usa **+ Transición**, ejemplo: `a,b,ε`.
5. Pulsa **Ejecutar Arden** para ver el resultado.
6. Exporta/importa con JSON para guardar o cargar tu trabajo.

## Notación usada

- Unión: `+`
- Concatenación: implícita (ej. `ab`)
- Cerradura de Kleene: `*`
- Épsilon: `ε`
- Vacío: `∅`
