/**
 * CONTROLE DE PAGAMENTOS — script.js
 * Frontend puro com integração Google Apps Script via fetch()
 * -----------------------------------------------------------
 * Substitua a variável SCRIPT_URL pela URL gerada no Apps Script.
 */

// ============================================================
// 1. CONFIGURAÇÃO
// ============================================================

/** URL do Web App publicado no Google Apps Script. */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyzCckMtn_SWLmQgxm3Jl4n78BkIAipH_IjG3EjEAxbKg4RSVGp-Z7seuNIDHdTDzS-/exec";


// ============================================================
// 2. REFERÊNCIAS DO DOM
// ============================================================

const heroScreen   = document.getElementById("heroScreen");
const openFormBtn  = document.getElementById("openFormBtn");
const closeFormBtn = document.getElementById("closeFormBtn");
const overlay      = document.getElementById("overlay");
const formPanel    = document.getElementById("formPanel");
const paymentForm  = document.getElementById("paymentForm");
const submitBtn    = document.getElementById("submitBtn");
const successMsg   = document.getElementById("successMsg");
const newPaymentBtn = document.getElementById("newPaymentBtn");

// Campos
const fieldName       = document.getElementById("fieldName");
const fieldInstituicao = document.getElementById("fieldInstituicao");
const fieldData       = document.getElementById("fieldData");
const fieldParcela    = document.getElementById("fieldParcela");

// Spans de erro
const errorName       = document.getElementById("errorName");
const errorInstituicao = document.getElementById("errorInstituicao");
const errorData       = document.getElementById("errorData");
const errorParcela    = document.getElementById("errorParcela");


// ============================================================
// 3. ABERTURA E FECHAMENTO DO PAINEL
// ============================================================

/** Abre o painel lateral com animação. */
function openPanel() {
  formPanel.classList.add("is-open");
  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");
  formPanel.setAttribute("aria-hidden", "false");
  // Foca no primeiro campo após a transição para acessibilidade
  setTimeout(() => fieldName.focus(), 350);
}

/** Fecha o painel e reseta o estado. */
function closePanel() {
  formPanel.classList.remove("is-open");
  overlay.classList.remove("is-visible");
  overlay.setAttribute("aria-hidden", "true");
  formPanel.setAttribute("aria-hidden", "true");
  // Espera a animação encerrar para resetar
  setTimeout(resetPanel, 400);
}

/** Reseta formulário, erros e mensagem de sucesso. */
function resetPanel() {
  paymentForm.reset();
  clearAllErrors();
  showForm();
}


// ============================================================
// 4. ALTERNÂNCIA ENTRE FORMULÁRIO E MENSAGEM DE SUCESSO
// ============================================================

function showForm() {
  paymentForm.hidden    = false;
  successMsg.hidden     = true;
}

function showSuccess() {
  paymentForm.hidden    = true;
  successMsg.hidden     = false;
}


// ============================================================
// 5. VALIDAÇÃO DOS CAMPOS
// ============================================================

/**
 * Valida um campo individual.
 * Retorna true se válido, false se inválido.
 */
function validateField(input, errorEl, message) {
  const value = input.value.trim();
  if (!value) {
    setError(input, errorEl, message);
    return false;
  }
  clearError(input, errorEl);
  return true;
}

function setError(input, errorEl, message) {
  input.classList.add("is-error");
  errorEl.textContent = message;
}

function clearError(input, errorEl) {
  input.classList.remove("is-error");
  errorEl.textContent = "";
}

function clearAllErrors() {
  clearError(fieldName,        errorName);
  clearError(fieldInstituicao, errorInstituicao);
  clearError(fieldData,        errorData);
  clearError(fieldParcela,     errorParcela);
}

/**
 * Valida todos os campos do formulário.
 * Retorna true se tudo estiver OK.
 */
function validateAll() {
  const v1 = validateField(fieldName,        errorName,        "Informe o nome do cliente.");
  const v2 = validateField(fieldInstituicao, errorInstituicao, "Selecione a instituição.");
  const v3 = validateField(fieldData,        errorData,        "Informe a data de recebimento.");
  const v4 = validateField(fieldParcela,     errorParcela,     "Informe o número da parcela.");

  // Validação extra: parcela deve ser número positivo
  if (v4 && (parseInt(fieldParcela.value) < 1 || isNaN(parseInt(fieldParcela.value)))) {
    setError(fieldParcela, errorParcela, "A parcela deve ser um número maior que zero.");
    return false;
  }

  return v1 && v2 && v3 && v4;
}


// ============================================================
// 6. ESTADO DO BOTÃO ENVIAR (loading / normal)
// ============================================================

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("is-loading", isLoading);
  submitBtn.setAttribute("aria-busy", isLoading ? "true" : "false");
}


// ============================================================
// 7. ENVIO DO FORMULÁRIO
// ============================================================

/**
 * Coleta os dados do formulário, valida e envia via fetch()
 * para o Google Apps Script.
 */
async function handleSubmit(e) {
  e.preventDefault();

  // Valida antes de enviar
  if (!validateAll()) return;

  // Monta objeto de dados
  const payload = {
    nome:            fieldName.value.trim(),
    instituicao:     fieldInstituicao.value,
    dataRecebimento: fieldData.value,
    parcela:         parseInt(fieldParcela.value, 10),
  };

  console.log("📤 Enviando payload:", payload);

  setLoading(true);

  try {
    // Envia para o Apps Script
    // O Apps Script requer envio como text/plain ou form-data para evitar CORS preflight.
    // Aqui usamos JSON.stringify + no-cors se necessário; mas com CORS configurado no GAS
    // podemos usar JSON direto com mode: "cors".
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // evita preflight no GAS
      body: JSON.stringify(payload),
    });

    // O GAS sempre retorna 200 mesmo em erro de lógica — lemos o JSON de resposta
    const result = await response.json();

    console.log("📥 Resposta:", result);

    if (result.status === "ok") {
      // Sucesso!
      showSuccess();
    } else {
      // Erro retornado pelo Apps Script
      alert(`Erro: ${result.message || "Ocorreu um problema. Tente novamente."}`);
    }

  } catch (err) {
    // Erro de rede ou parsing
    console.error("Erro na requisição:", err);
    alert("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
  } finally {
    setLoading(false);
  }
}


// ============================================================
// 8. LIMPAR ERRO AO DIGITAR (UX)
// ============================================================

/** Remove o erro do campo assim que o usuário começa a preencher. */
function clearOnInput(input, errorEl) {
  input.addEventListener("input", () => clearError(input, errorEl));
  input.addEventListener("change", () => clearError(input, errorEl));
}

clearOnInput(fieldName,        errorName);
clearOnInput(fieldInstituicao, errorInstituicao);
clearOnInput(fieldData,        errorData);
clearOnInput(fieldParcela,     errorParcela);


// ============================================================
// 9. EVENT LISTENERS
// ============================================================

// Abre o painel
openFormBtn.addEventListener("click", openPanel);

// Fecha pelo X ou pelo overlay
closeFormBtn.addEventListener("click", closePanel);
overlay.addEventListener("click", closePanel);

// Fecha com tecla Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && formPanel.classList.contains("is-open")) {
    closePanel();
  }
});

// Envio do formulário
paymentForm.addEventListener("submit", handleSubmit);

// Botão "Registrar outro" após sucesso
newPaymentBtn.addEventListener("click", () => {
  paymentForm.reset();
  clearAllErrors();
  showForm();
  setTimeout(() => fieldName.focus(), 50);
});
