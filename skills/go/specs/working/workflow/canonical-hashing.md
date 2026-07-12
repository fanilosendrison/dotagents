# Hashing canonique du workflow `/go`

Ce document definit comment `/go` calcule les hashes d'objets JSON metier.

Le principe est simple : `/go` ne reinvente pas une canonicalisation JSON. Les
objets JSON hashables utilisent un profil `/go` de RFC 8785, JSON
Canonicalization Scheme (JCS).

Ce document est une specialization de la regle transversale decrite dans
[`external-primitives.md`](./external-primitives.md) : reutiliser les primitives
externes etablies avant de definir une variante `/go`.

Reference normative :

- RFC 8785 / JCS : <https://www.rfc-editor.org/rfc/rfc8785>

---

## 1. Perimetre

Ce document s'applique aux hashes de payloads JSON metier, par exemple :

- `RepositoryLaunchContext` ;
- `WorkflowPolicy` ;
- ownership markers ;
- objets de policy ou d'intent figes ;
- payloads JSON qui servent d'input a une decision de retry, resume ou audit.

Il ne s'applique pas directement a :

- `trackedWorktreeHash`, qui est une empreinte de l'etat Git tracke sur disque ;
- hash de patch ou de diff brut ;
- hash d'un fichier d'evidence, calcule sur les octets exacts du fichier ;
- hash Git natif, object id, commit SHA ou tree SHA ;
- `output.json` lisible par humain quand il n'est pas lui-meme l'input d'un
  hash cryptographique.

Ces cas doivent avoir leur propre algorithme metier explicite.

---

## 2. Pipeline normatif

Le hash canonique `/go` d'un objet JSON suit toujours ce pipeline :

```text
domain object
-> schema validation
-> domain normalization
-> RFC 8785 / JCS serialization
-> UTF-8 bytes
-> SHA-256
-> "sha256:<lowercase-hex>"
```

La formule canonique est :

```text
canonicalHash(value) = "sha256:" + sha256_hex(jcs_bytes(normalize(value)))
```

---

## 3. JCS comme standard de serialization

La serialization JSON hashable doit suivre RFC 8785 / JCS.

Implications normatives :

- les objets sont serialises avec un ordre de proprietes deterministe ;
- aucun whitespace hors strings n'est introduit ;
- les primitives JSON suivent les regles JCS ;
- les inputs doivent rester dans le sous-ensemble I-JSON attendu par JCS ;
- les bytes hashes sont les bytes UTF-8 de la sortie JCS.

Une implementation doit utiliser une bibliotheque JCS compatible RFC 8785 quand
elle est disponible et maintenue. Une implementation maison est acceptable
seulement si elle est testee contre des vecteurs RFC 8785 ou equivalents.

---

## 4. Normalisation metier avant JCS

JCS ne decide pas la semantique metier. Avant serialization JCS, `/go` doit
normaliser les objets selon leur schema.

Regles transverses :

- les champs optionnels absents restent absents ;
- `null` n'est jamais equivalent a un champ absent ;
- les arrays conservent leur ordre metier ;
- les timestamps presents dans l'objet font partie du hash ;
- aucun champ derive non declare par le schema ne doit etre ajoute avant hash ;
- aucun champ non deterministe ne doit etre regenere pendant un retry.

Regles de chemins :

- un chemin deja canonique dans l'objet est hashe tel quel ;
- les symlinks, realpaths, trailing slashes et chemins relatifs sont resolus
  avant construction de l'objet metier, pas par JCS ;
- si deux representations de chemin ont le meme sens pour le filesystem mais des
  strings differentes, elles produisent des hashes differents ;
- la correction appartient au producteur du payload, pas au hash.

---

## 5. Snapshot, pas recalcul

Le hash prouve l'identite du snapshot gele, pas l'identite approximative d'une
decision.

Exemple :

```text
RepositoryLaunchContext resolvedAt = 2026-07-13T10:00:00.000Z
```

`resolvedAt` fait partie du snapshot et donc du hash. Sur resume, le parent
process ne doit pas recalculer un nouveau `RepositoryLaunchContext` avec un
nouveau timestamp. Turnlock doit fournir le snapshot initial au retry, ou le
retry doit echouer ferme.

---

## 6. Formats de hash

Tous les hashes JCS `/go` utilisent :

```text
sha256:<lowercase-hex>
```

Exemples de champs :

- `launchContextHash` ;
- `workflowPolicyHash` ;
- hash d'un objet de review intent si un futur stage en introduit un.

Un hash sans prefixe d'algorithme n'est pas valide pour les nouveaux artefacts
JSON metier.

---

## 7. Non-cas et roues existantes

### `trackedWorktreeHash`

`trackedWorktreeHash` n'est pas une canonicalisation JSON. C'est une empreinte
de fichiers trackes, modes Git, symlinks, suppressions et submodules. Son
algorithme reste specifique au stage harness.

### `output.json`

Le stage harness peut ecrire un `output.json` pretty-print pour lisibilite et
debug, tant que ce fichier n'est pas utilise comme input de hash canonique. Si
un hash de `StageOutput` devient necessaire, l'objet `StageOutput` doit etre
serialise avec JCS avant hash.

### Patchs et diffs

Les patchs et diffs sont hashes sur leurs bytes exacts apres generation
canonique par l'outil declare. JCS ne s'applique pas a ces flux texte.

### Git

Les object ids, commit SHAs, tree SHAs et refs Git restent proprietes de Git.
`/go` ne remplace pas les primitives Git par un hash JSON.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
