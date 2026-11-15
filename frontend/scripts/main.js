// Sem conexão de dados ou ações de usuário nesta primeira etapa.
const year = document.querySelector("#ano");
if (year) {
  year.textContent = String(new Date().getFullYear());
}
