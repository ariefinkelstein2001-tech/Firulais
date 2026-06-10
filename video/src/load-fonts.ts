import { continueRender, delayRender, staticFile } from "remotion";

// Carga la fuente de marca BobbyJones antes de renderizar cualquier frame.
const handle = delayRender("Cargando fuente BobbyJones");

const font = new FontFace(
  "BobbyJones",
  `url(${staticFile("BobbyJones.woff2")}) format("woff2")`,
);

font
  .load()
  .then(() => {
    document.fonts.add(font);
    continueRender(handle);
  })
  .catch((err) => {
    // Si falla la fuente, seguimos con el fallback para no trabar el render.
    console.error("No se pudo cargar BobbyJones:", err);
    continueRender(handle);
  });
