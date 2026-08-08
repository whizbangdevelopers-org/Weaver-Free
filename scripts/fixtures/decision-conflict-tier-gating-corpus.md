<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Regression corpus — `detect-structured` tier-gating rule

Consumed by `scripts/decision-conflict/detect-structured.self-test.ts`. The auditor **refuses to
run** if this corpus fails, so "found nothing" can be distinguished from "cannot find anything".

Every table row below is annotated on the line ABOVE it:

- `<!-- expect: CATCH -->` — the rule MUST report this row.
- `<!-- expect: IGNORE -->` — the rule MUST NOT report this row.

Both halves matter. The rule shipped with neither, and its first real-world encounter with a
legitimate row produced a false positive (the `SSO`-in-a-prose-cell case below): a rule that flags
the sanctioned pattern gets switched off, after which it catches nothing at all.

---

## CATCH — genuine tier-split violations

A Fabrick-only capability sitting in the tier cell **adjacent** to the feature cell.

<!-- expect: CATCH -->
| Per-VM ACL | Free | ✓ | v1.0 |

<!-- expect: CATCH -->
| Policy routing | free | planned | v3.0 |

<!-- expect: CATCH -->
| SSO | Free | ✓ | v3.x |

<!-- expect: CATCH -->
| Live migration | Free | ✓ | v3.0 |

<!-- expect: CATCH -->
| Fleet bridge | Free | ✓ | v2.0 |

<!-- expect: CATCH -->
| Cross-host | Free | ✓ | v2.3 |

---

## IGNORE — legitimate rows that must not fire

### The false positive that motivated the fix

`SSO` describes Tailscale's third-party login as a **drawback**, four cells from the tier cell. It
is not a claim about Weaver's SSO feature tier. The word "free" appears three times on the line —
once as the tier, twice as English prose ("free funnel", "their free tier").

<!-- expect: IGNORE -->
| **Tailscale wizard** | Free | Tailscale (proprietary) | ✅ works behind CGNAT | Third-party account + SSO; your free funnel depends on their free tier |

### Correct tier assignments for genuinely Free features

<!-- expect: IGNORE -->
| WireGuard setup wizard | Free | ✓ | v1.3 |

<!-- expect: IGNORE -->
| Container start/stop/restart | Free | ✓ | v1.2 |

### A Fabrick-only feature correctly assigned to Fabrick, with "free" elsewhere in prose

<!-- expect: IGNORE -->
| Per-VM ACL | Fabrick | Not available on the free tier | v1.0 |

<!-- expect: IGNORE -->
| SSO | Fabrick | LDAP and SSO are Fabrick-only; the free tier has local auth | v3.x |

### Substring traps — word-boundary half of the fix

`sso` inside another word must not match. Under the old bare-`includes` matcher these fired.

<!-- expect: IGNORE -->
| Lasso selection tool | Free | ✓ | v2.1 |

<!-- expect: IGNORE -->
| Assorted sample templates | Free | ✓ | v2.0 |

### Distance, not just prose — a Fabrick feature named far from a Free tier cell

The feature named here belongs to a *different* row's subject; the tier cell is not adjacent.

<!-- expect: IGNORE -->
| Topology visualization | Free | Strands page | Does not include cross-host views |
