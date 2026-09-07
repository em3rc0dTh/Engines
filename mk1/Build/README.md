# MK1 Build / Evidence Registry

Executable MK1 source is not promoted into `main` by this docs-only index. Use the exact source branch/receipt for reproduction.

Current high-level authorities:

```text
Services S7
  Source    6fc8814830038b5600c4c6376cd9b4ed7ef34b7a
  Run       33668593216
  Job       100376325350
  Artifact  9861631780

WebChat C1B
  Source    2008fce4f863fdabf8e8f323eee1d7cda05cb454
  Run       33647842017
  Job       100307008849
  Artifact  9853555059

Customer B2
  Source    36afff68af3237bd6431fd643d7d969e5452a296
  Run       33899907141
  Job       101111281727
  Artifact  9947248334

Telegram physical seal
  Source    28dd5c9f2dd2352d3e11b83cc6602cea1b568760
  Run       33927626629
  Job       101199465863
  Artifact  9957384230

Kapso deterministic authority
  Source    8662a06c5787add829df36bea7e3f8ec5f1ecdf4
  Run       34141751510
  Job       101805053784
  Artifact  10026183649

Meta Cloud API deterministic authority
  Source    72eb616153a8c4494f240ea825299e18d4aef156
  Run       33929572965
  Job       101205251200
  Artifact  9958063555
```

Detailed receipts remain under the active branch `mk1/Build/evidence/` directories. The consolidated customer/channel anchor contains Telegram and Kapso receipts.

Evidence rule:

```text
source SHA + run/job/artifact + bounded claim + non-claims
```

Later docs-only commits never replace the executed runtime source SHA.
