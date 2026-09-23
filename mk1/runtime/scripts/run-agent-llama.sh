#!/bin/sh
set -eu

MODEL_ALIAS="${AGENT_MODEL_ALIAS:-engines-agent-local}"
MODEL_PATH="${AGENT_MODEL_PATH:-/models/qwen2.5-1.5b-instruct-q4_k_m.gguf}"
MODEL_URL="${AGENT_MODEL_URL:-https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf}"
MODEL_SHA256="${AGENT_MODEL_SHA256:-6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e}"
THREADS="${AGENT_THREADS:-4}"
THREADS_BATCH="${AGENT_THREADS_BATCH:-4}"
CTX_SIZE="${AGENT_CTX_SIZE:-4096}"
PARALLEL="${AGENT_PARALLEL:-1}"
PREDICT="${AGENT_PREDICT:-128}"
BATCH_SIZE="${AGENT_BATCH_SIZE:-256}"
UBATCH_SIZE="${AGENT_UBATCH_SIZE:-128}"

verify_model() {
  echo "${MODEL_SHA256}  ${MODEL_PATH}" | sha256sum -c - >/dev/null 2>&1
}

mkdir -p "$(dirname "${MODEL_PATH}")"

if [ -f "${MODEL_PATH}" ] && ! verify_model; then
  echo "AGENT_LLAMA_MODEL_CHECKSUM_MISMATCH path=${MODEL_PATH}; redownloading"
  rm -f "${MODEL_PATH}"
fi

if [ ! -f "${MODEL_PATH}" ]; then
  tmp="${MODEL_PATH}.part"
  rm -f "${tmp}"
  echo "AGENT_LLAMA_MODEL_DOWNLOAD_START url=${MODEL_URL}"
  curl -L --fail --retry 5 --retry-delay 2 --retry-all-errors \
    -o "${tmp}" "${MODEL_URL}"
  echo "${MODEL_SHA256}  ${tmp}" | sha256sum -c -
  mv "${tmp}" "${MODEL_PATH}"
fi

echo "${MODEL_SHA256}  ${MODEL_PATH}" | sha256sum -c -
echo "AGENT_LLAMA_MODEL_READY alias=${MODEL_ALIAS} path=${MODEL_PATH}"
echo "AGENT_LLAMA_SERVER_START threads=${THREADS} ctx=${CTX_SIZE} parallel=${PARALLEL}"

exec /usr/local/bin/llama-server \
  -m "${MODEL_PATH}" \
  --alias "${MODEL_ALIAS}" \
  --host 0.0.0.0 \
  --port 8080 \
  --threads "${THREADS}" \
  --threads-batch "${THREADS_BATCH}" \
  --ctx-size "${CTX_SIZE}" \
  --parallel "${PARALLEL}" \
  --predict "${PREDICT}" \
  --batch-size "${BATCH_SIZE}" \
  --ubatch-size "${UBATCH_SIZE}" \
  --no-mmproj
