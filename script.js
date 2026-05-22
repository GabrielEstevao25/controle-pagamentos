/**
 * CONTROLE DE PAGAMENTOS — script.js
 */

// ============================================================
// 1. CONFIGURAÇÃO
// ============================================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyzCckMtn_SWLmQgxm3Jl4n78BkIAipH_IjG3EjEAxbKg4RSVGp-Z7seuNIDHdTDzS-/exec";

// ============================================================
// 2. REFERÊNCIAS DO DOM
// ============================================================

const openFormBtn       = document.getElementById("openFormBtn");
const closeFormBtn      = document.getElementById("closeFormBtn");
const overlay           = document.getElementById("overlay");
const formPanel         = document.getElementById("formPanel");
const paymentForm       = document.getElementById("paymentForm");
const submitBtn         = document.getElementById("submitBtn");
const successMsg        = document.getElementById("successMsg");
const newPaymentBtn     = document.getElementById("newPaymentBtn");

const fieldInstituicao  = document.getElementById("fieldInstituicao");
const toggleInstituicao = document.getElementById("toggleInstituicao");
const instituicaoList   = document.getElementById("instituicaoList");
const fieldName         = document.getElementById("fieldName");
const fieldData         = document.getElementById("fieldData");
const fieldParcela      = document.getElementById("fieldParcela");

const errorInstituicao  = document.getElementById("errorInstituicao");
const errorName         = document.getElementById("errorName");
const errorData         = document.getElementById("errorData");
const errorParcela      = document.getElementById("errorParcela");

// ============================================================
// 3. ESTADO
// ============================================================

let todasInstituicoes      = [];
let instituicaoSelecionada = null;

// ============================================================
// 4. ABERTURA E FECHAMENTO DO PAINEL
// ============================================================

function openPanel() {
  formPanel.classList.add("is-open");
  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");
  formPanel.setAttribute("aria-hidden", "false");
  carregarInstituicoes();
  setTimeout(() => fieldInstituicao.focus(), 350);
}

function closePanel() {
  formPanel.classList.remove("is-open");
  overlay.classList.remove("is-visible");
  overlay.setAttribute("aria-hidden", "true");
  formPanel.setAttribute("aria-hidden", "true");
  setTimeout(resetPanel, 400);
}

function resetPanel() {
  paymentForm.reset();
  clearAllErrors();
  showForm();
  instituicaoSelecionada = null;
  resetClientes();
  fecharAutocomplete();
}

// ============================================================
// 5. ALTERNÂNCIA FORMULÁRIO / SUCESSO
// ============================================================

function showForm() {
  paymentForm.hidden = false;
  successMsg.hidden  = true;
}

function showSuccess() {
  paymentForm.hidden = true;
  successMsg.hidden  = false;
}

// ============================================================
// 6. CARREGA INSTITUIÇÕES
// ============================================================

async function carregarInstituicoes() {
  try {
    const res  = await fetch(`${SCRIPT_URL}?action=instituicoes`);
    const data = await res.json();
    if (data.status === "ok") {
      todasInstituicoes = data.data;
    }
  } catch (err) {
    console.error("Erro ao carregar instituições:", err);
  }
}

// ============================================================
// 7. AUTOCOMPLETE DE INSTITUIÇÃO
// ============================================================

fieldInstituicao.addEventListener("input", () => {
  const termo = fieldInstituicao.value.trim().toLowerCase();
  clearError(fieldInstituicao, errorInstituicao);

  if (instituicaoSelecionada && fieldInstituicao.value !== instituicaoSelecionada) {
    instituicaoSelecionada = null;
    resetClientes();
  }

  if (!termo) {
    fecharAutocomplete();
    return;
  }

  const filtradas = todasInstituicoes.filter(i => i.toLowerCase().includes(termo));
  filtradas.length > 0 ? renderAutocomplete(filtradas) : fecharAutocomplete();
});

toggleInstituicao.addEventListener("mousedown", (e) => {
  e.preventDefault();
  if (!instituicaoList.hidden) {
    fecharAutocomplete();
    return;
  }
  renderAutocomplete(todasInstituicoes);
  fieldInstituicao.focus();
});

function renderAutocomplete(lista) {
  instituicaoList.innerHTML = "";
  lista.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    li.setAttribute("role", "option");
    li.addEventListener("mousedown", () => selecionarInstituicao(item));
    instituicaoList.appendChild(li);
  });
  instituicaoList.hidden = false;
}

function fecharAutocomplete() {
  instituicaoList.hidden = true;
  instituicaoList.innerHTML = "";
}

async function selecionarInstituicao(nome) {
  fieldInstituicao.value = nome;
  instituicaoSelecionada = nome;
  fecharAutocomplete();
  clearError(fieldInstituicao, errorInstituicao);
  await carregarClientes(nome);
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".autocomplete-wrapper")) {
    fecharAutocomplete();
  }
});

// ============================================================
// 8. CARREGA CLIENTES
// ============================================================

async function carregarClientes(instituicao) {
  fieldName.disabled = true;
  fieldName.innerHTML = '<option value="" disabled selected>Carregando...</option>';

  try {
    const res  = await fetch(`${SCRIPT_URL}?action=clientes&instituicao=${encodeURIComponent(instituicao)}`);
    const data = await res.json();

    if (data.status === "ok" && data.data.length > 0) {
      fieldName.innerHTML = '<option value="" disabled selected>Selecione o cliente</option>';
      data.data.forEach(cliente => {
        const opt = document.createElement("option");
        opt.value       = cliente;
        opt.textContent = cliente;
        fieldName.appendChild(opt);
      });
      fieldName.disabled = false;
    } else {
      fieldName.innerHTML = '<option value="" disabled selected>Nenhum cliente encontrado</option>';
    }
  } catch (err) {
    console.error("Erro ao carregar clientes:", err);
    fieldName.innerHTML = '<option value="" disabled selected>Erro ao carregar</option>';
  }
}

function resetClientes() {
  fieldName.disabled = true;
  fieldName.innerHTML = '<option value="" disabled selected>Selecione a instituição primeiro</option>';
}

// ============================================================
// 9. VALIDAÇÃO
// ============================================================

function validateInstituicao() {
  if (!instituicaoSelecionada) {
    setError(fieldInstituicao, errorInstituicao, "Selecione uma instituição válida da lista.");
    return false;
  }
  clearError(fieldInstituicao, errorInstituicao);
  return true;
}

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
  clearError(fieldInstituicao, errorInstituicao);
  clearError(fieldName,        errorName);
  clearError(fieldData,        errorData);
  clearError(fieldParcela,     errorParcela);
}

function validateAll() {
  const v1 = validateInstituicao();
  const v2 = validateField(fieldName,    errorName,    "Selecione o cliente.");
  const v3 = validateField(fieldData,    errorData,    "Informe a data de recebimento.");
  const v4 = validateField(fieldParcela, errorParcela, "Informe o número da parcela.");

  if (v4 && (parseInt(fieldParcela.value) < 1 || isNaN(parseInt(fieldParcela.value)))) {
    setError(fieldParcela, errorParcela, "A parcela deve ser um número maior que zero.");
    return false;
  }

  return v1 && v2 && v3 && v4;
}

// ============================================================
// 10. LOADING
// ============================================================

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("is-loading", isLoading);
  submitBtn.setAttribute("aria-busy", isLoading ? "true" : "false");
}

// ============================================================
// 11. ENVIO DO FORMULÁRIO
// ============================================================

async function handleSubmit(e) {
  e.preventDefault();
  if (!validateAll()) return;

  const payload = {
    nome:            fieldName.value,
    instituicao:     instituicaoSelecionada,
    dataRecebimento: fieldData.value,
    parcela:         parseInt(fieldParcela.value, 10),
  };

  console.log("📤 Enviando payload:", payload);
  setLoading(true);

  try {
    const response = await fetch(SCRIPT_URL, {
      method:  "POST",
      headers: { "Content-Type": "text/plain" },
      body:    JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("📥 Resposta:", result);

    if (result.status === "ok") {
      showSuccess();
    } else {
      alert(`Erro: ${result.message || "Ocorreu um problema. Tente novamente."}`);
    }
  } catch (err) {
    console.error("Erro na requisição:", err);
    alert("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
  } finally {
    setLoading(false);
  }
}

// ============================================================
// 12. LIMPA ERRO AO INTERAGIR
// ============================================================

fieldData.addEventListener("input",    () => clearError(fieldData,    errorData));
fieldParcela.addEventListener("input", () => clearError(fieldParcela, errorParcela));
fieldName.addEventListener("change",   () => clearError(fieldName,    errorName));

// ============================================================
// 13. EVENT LISTENERS
// ============================================================

openFormBtn.addEventListener("click", openPanel);
closeFormBtn.addEventListener("click", closePanel);
overlay.addEventListener("click", closePanel);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && formPanel.classList.contains("is-open")) closePanel();
});

paymentForm.addEventListener("submit", handleSubmit);

newPaymentBtn.addEventListener("click", () => {
  paymentForm.reset();
  clearAllErrors();
  showForm();
  instituicaoSelecionada = null;
  resetClientes();
  setTimeout(() => fieldInstituicao.focus(), 50);
});