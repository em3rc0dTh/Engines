# Agent Layer — A1 Real Local Inference Gate

Date: 2026-09-22

## Build

1. Add llama.cpp provider below the A0 ModelProvider contract.
2. Keep raw provider output untrusted.
3. Build JSON Schema from current Engine allowedActions.
4. Carry resolved Soul / Personality into the prompt.
5. Pin llama.cpp laboratory source.
6. Use Qwen2.5 1.5B Instruct Q4_K_M as the first candidate.
7. Run one generation at a time.
8. Keep context at 4096 maximum and output at 128 maximum.
9. Run a real Spanish conversational golden slice.
10. Measure per-turn latency.
11. Measure model-server RSS.
12. Fail if inference RSS exceeds 2304 MB.
13. Preserve A0 and protected PRE-AGENT regressions.

## A1 seal

A1 may be sealed only when one exact head proves:

~~~text
TypeScript
A0 tests
A1 provider tests
real llama.cpp model load
schema-constrained response
golden Spanish cases
canonical-id preservation
Engine allowed-action validation
latency measurement
RSS cap
protected PRE-AGENT regressions
~~~

## A2 transition

A2 will wire Agent Layer into a real channel/Engine journey and perform the first complete-node resource proof against the hard 4 vCPU / 8 GB total target.
