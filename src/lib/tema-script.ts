// Corre antes de pintar la página: aplica el tema guardado (o el del sistema) sin parpadeo.
export const SCRIPT_TEMA = `try{var t=localStorage.getItem('tema');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}`
