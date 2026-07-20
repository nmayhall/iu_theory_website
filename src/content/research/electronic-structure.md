---
title: Electronic Structure Theory & Method Development
motif: electronic-structure
summary: >-
  Building the wavefunction methods, fragmentation schemes, and correlated approaches that
  define what quantum chemistry can accurately predict — including CCSD(T), the field's
  gold standard.
faculty:
  - raghavachari
  - mayhall
  - iyengar
order: 1
---

Work in this area spans coupled-cluster theory, fragment-based methods that make large
molecules tractable, and approaches to strong correlation where conventional
single-reference treatments break down.

Coupled-cluster theory builds the correlated wavefunction from an exponential ansatz
acting on a reference determinant,

$$
|\Psi\rangle = e^{\hat{T}} |\Phi_0\rangle,
\qquad
\hat{T} = \hat{T}_1 + \hat{T}_2 + \cdots
$$

where truncating $\hat{T}$ at double excitations and treating triples perturbatively gives
CCSD(T).
