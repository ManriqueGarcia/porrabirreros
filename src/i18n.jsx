import { createContext, useContext } from "react";

export const I18N = {
  es: {
    login: "Entrar", save: "Guardar", cancel: "Cancelar", loading: "Cargando...", ranking: "Ranking",
    participant: "Participante", admin: "Admin", rules: "Reglas", stats: "Estadísticas", questions: "Preguntas",
    historic: "Histórico", shareBet: "Compartir apuesta", exportCsv: "Exportar CSV",
    darkMode: "Modo claro", lightMode: "Modo oscuro", language: "Idioma",
    betSaved: "Apuesta guardada correctamente", betLate: "Apuesta registrada (fuera de plazo: penalización -2 pts)",
    noData: "No hay datos disponibles", position: "Pos", name: "Nombre", points: "Puntos",
    victories: "Vict.", podiums: "Pod.", hits: "Aciert.", penalties: "Pen.",
  },
  en: {
    login: "Log in", save: "Save", cancel: "Cancel", loading: "Loading...", ranking: "Ranking",
    participant: "Participant", admin: "Admin", rules: "Rules", stats: "Statistics", questions: "Questions",
    historic: "History", shareBet: "Share bet", exportCsv: "Export CSV",
    darkMode: "Light mode", lightMode: "Dark mode", language: "Language",
    betSaved: "Bet saved successfully", betLate: "Bet registered (late: -2 pts penalty)",
    noData: "No data available", position: "Pos", name: "Name", points: "Points",
    victories: "Wins", podiums: "Pod.", hits: "Hits", penalties: "Pen.",
  }
};

export const LangCtx = createContext("es");
export function useLang() { return useContext(LangCtx); }
export function t(key, lang) { return I18N[lang]?.[key] || I18N.es[key] || key; }
