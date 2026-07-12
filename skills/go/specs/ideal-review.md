# Ideal Review — Les 13 dimensions non-négociables

Ce document définit ce qu'une review de code **doit absolument** vérifier.
Il est dérivé du système `loop-clean` (Claude Code, sans FSM) et constitue
le cahier des charges des phases `pre-pr-review` et `pr-ci-review` du pipeline
`/go`.

Aucune mention d'implémentation, de FSM, de sub-agents, ou d'outils. Juste
ce qui doit être vérifié, et pourquoi.

Le contrat d'exécution, les sévérités encodées, les artefacts JSON, et les gates
humaines sont définis dans `go-pipeline-contract.md`. Ce document reste la
source de vérité sémantique : il dit **quoi vérifier**.

---

## 1. Correctness — « Est-ce que ça marche ? »

Le code produit le comportement attendu. Pas de bug, pas d'angle mort.

### Ce qui est vérifié

- **Absence de triche** : le code ne passe pas les tests par accident — pas de valeur de retour constante, pas de court-circuit qui évite le vrai chemin d'exécution, pas de `if` qui match les fixtures mais pas le cas général.
- **Edge cases** : input vide, `null`, `undefined`, off-by-one, bornes inclusives/exclusives, overflow, caractères spéciaux, Unicode, CRLF vs LF, collections vides, élément unique, doublons.
- **Pas de régression silencieuse** : changement de valeur par défaut, ordre d'exécution modifié, comportement implicite dont dépendent d'autres modules sans test explicite.
- **Déterminisme** : le code utilise-t-il `Date.now()`, `Math.random()`, l'ordre d'itération de `Object.keys()`, ou d'autres sources de non-déterminisme dans sa logique ? Les résultats sont-ils reproductibles avec les mêmes inputs ? Les tests sont-ils flaky à cause de dépendances sur le temps, l'aléatoire, ou l'ordre du filesystem ? L'IA ne pense jamais à injecter les sources de non-déterminisme — elle les utilise directement.

### Si c'est raté

Bug en production. Exemple : `extractBlocks` ignore les fins de ligne CRLF, silencieusement faux sur les fichiers Windows. Ou : un test passe 99 fois sur 100 parce qu'il dépend de `Date.now()` et échoue une fois par minute aux changements de seconde.

---

## 2. Robustness — « Est-ce que ça tient ? »

Le code ne casse pas face à un monde réel hostile. La différence avec Correctness : ici on ne vérifie pas le comportement nominal, mais la survie face à l'imprévu.

### Ce qui est vérifié

- **Chemins d'erreur** : cleanup après throw, `catch` qui avale l'erreur, état global corrompu après exception, promesses non awaitées qui échouent en silence.
- **Résilience du substrat** : que se passe-t-il si le processus crashe **entre deux syscalls** ? Corruption sur power loss, lock orphelin, `fsync` manquant avant `rename`, transaction orpheline, écriture partielle non retryée. Le crash n'est pas une erreur attrapable — le code n'a pas la main pour faire du cleanup.
- **Contrat d'entrée** : le type déclaré autorise des valeurs que le code ne supporte pas — cycles dans un objet, Proxy, getters à effets de bord, `NaN`, `-0`, surrogate pairs, promesses qui résolvent deux fois. La valeur passe le type-checker et crashe quand même.
- **Intégrité du type system** : le compilateur est-il trompé pour faire passer le code ? `any`, `unknown` non réduit, assertions `as`, non-null assertions `!`, casts entre types incompatibles, generics fantômes, unions discriminées non exhaustives, types publics élargis sans raison. Un code qui ment au type-checker remplace une erreur de compilation par un bug runtime.
- **Intégrité des données et invariants** : l'état invalide peut-il être représenté ? Une transaction peut-elle laisser des lignes orphelines, des doublons, un index stale, ou un fichier partiellement mis à jour ? Les invariants métier critiques sont-ils protégés au bon endroit, pas seulement supposés par les appelants ?
- **Performance** : O(n²) caché, allocations inutiles dans un hot path, appel synchrone bloquant là où l'async serait approprié, rebuild répété.
- **Concurrence et race conditions** : TOCTOU (Time-of-check to time-of-use) — `if (file.exists()) { file.read() }` où le fichier disparaît entre le check et le read. Data races — deux workers/goroutines/threads modifient la même structure sans synchronisation. Ordering assumptions — le code assume un ordre d'exécution que ni le runtime ni le scheduler ne garantissent. Deadlocks et livelocks — code qui prend plusieurs locks dans des ordres incohérents. L'IA produit du code qui a l'air séquentiel mais qui tourne dans un contexte concurrent.
- **Gestion des ressources et lifecycle** : file descriptors et handles ouverts et jamais fermés. Event listeners ajoutés et jamais retirés (memory leak classique en JS). Connexions (DB, HTTP, WebSocket) ouvertes et jamais closes. Timers (`setInterval`, `setTimeout`) jamais annulés. AbortController / cancellation : une opération async est-elle annulable ? Que se passe-t-il si le contexte qui l'a lancée disparaît avant qu'elle ne finisse ?
- **Timeouts, backpressure, limites** : les appels réseau, I/O, queues, workers, streams, et retries ont-ils des limites explicites ? Une file peut-elle croître sans borne ? Un service lent peut-il saturer tous les workers ? Un retry a-t-il un budget, un backoff, et une condition d'arrêt ?
- **Mutation non signalée** : une structure passée en argument est-elle mutée in-place alors que l'appelant ne s'y attend pas ? Un objet partagé entre modules est-il muté sans coordination ? Le state global (singletons, module-level variables) est-il thread-safe et re-entrant ? L'IA adore muter les arguments sans le signaler.
- **Idempotence et retry safety** : si une opération est retentée, produit-elle le même résultat ? Si un message est reçu deux fois, est-ce que ça crée un doublon ? Les opérations de write sont-elles idempotentes ou y a-t-il un risque d'effet cumulatif ? Un retry automatique sur une opération non-idempotente transforme un échec transient en corruption de données.

### Si c'est raté

Crash, corruption, ou fuite de ressources. Exemple : crash entre `write(tmp)` et `rename(tmp, final)` → `state.json` vide ou tronqué au prochain démarrage. Ou : un event listener ajouté à chaque appel sans `removeListener` → après 10 000 appels, le processus OOM.

---

## 3. Security — « Est-ce que c'est protégé contre la malveillance ? »

Le code résiste à une attaque intentionnelle. La différence avec Robustness : la Robustness couvre les accidents (crash, input anormal non malveillant), la Security couvre un adversaire qui cherche activement à exploiter le système.

> **Note sur l'ordre Robustness → Security** : Security est placé après Robustness parce qu'un code qui ne survit pas à un crash n'a pas besoin d'être protégé contre une attaque. Mais l'argument inverse est légitime : un crash on peut le restart, une injection on ne peut pas la un-exploit. Dans un contexte où la surface d'attaque est élevée (API publique, données utilisateur), inverser les deux est défendable.

### Ce qui est vérifié

- **Injection** : SQL, command, path traversal — une entrée utilisateur finit-elle dans une chaîne exécutée ou interprétée ? Toute concaténation de string dans une requête, une commande shell, ou un chemin de fichier avec de l'input non sanitizé est une vulnérabilité.
- **Secrets exposés** : clé API, token, mot de passe, certificat dans le code source, les logs, les messages d'erreur, ou le `state.json`. Un secret dans un fichier versionné est une fuite permanente. Un secret dans un log est une fuite différée.
- **Auth / AuthZ** : un endpoint, une fonction, ou un handler saute-t-il la vérification d'autorisation ? Un rôle peut-il accéder à une ressource qui ne lui est pas destinée ? L'identité de l'appelant est-elle vérifiée à chaque point d'entrée, ou un middleware est-il supposé l'avoir fait ?
- **Dépendances à risque** : une librairie utilisée a-t-elle des CVE connues ? Est-elle encore maintenue ? Une dépendance non maintenue avec des vulnérabilités documentées est une porte ouverte.
- **Désérialisation non sécurisée** : `eval()`, `new Function()`, `JSON.parse` sur de l'input non validé pouvant mener à du code arbitraire, `unserialize()`, `pickle.load()`. Toute opération qui transforme une string en code exécutable est une surface d'attaque.
- **Exposition de données** : des données sensibles (PII, secrets, données métier critiques) sont-elles loggées en clair, renvoyées dans les réponses d'erreur, ou stockées sans chiffrement ? Un message d'erreur qui inclut la stack trace complète avec des variables locales est une fuite.
- **Timing / side-channel** : une comparaison de secrets utilise-t-elle `===` ou `==` (vulnérable au timing attack) au lieu d'une comparaison en temps constant ? Une opération sensible a-t-elle un temps d'exécution qui dépend de la valeur secrète ?
- **CSRF / CORS** : les origines sont-elles correctement restreintes ? Un site tiers peut-il déclencher une action authentifiée sans que l'utilisateur le sache ? Les cookies sensibles ont-ils `SameSite` ?

### Sous-section conditionnelle — Privacy / données utilisateur

Si le code touche des données utilisateur, de la télémétrie, des prompts, des exports, ou des traces : vérifier explicitement la minimisation des données collectées, la présence de PII dans les logs, la rétention, la suppression, le consentement, l'anonymisation/pseudonymisation, et les chemins où une donnée privée peut sortir du périmètre attendu. Une donnée utilisateur dans un prompt LLM, un log debug, ou un event analytics est une fuite potentielle même si aucune attaque n'a lieu.

### Si c'est raté

Faille exploitable. Exemple : une entrée utilisateur est concaténée dans une commande shell sans échappement → injection de commande → exécution de code arbitraire sur le serveur. Ou : un token API est loggé en clair dans les logs d'erreur → les logs sont accessibles à plus de monde que le secret → fuite.

---

## 4. Spec Conformance — « Est-ce que ça respecte le contrat ? »

Le code implémente ce que la spec exige — ni plus, ni moins. Cette dimension est orthogonale à Correctness : un code peut être parfaitement correct en interne mais ne pas implémenter ce qui est spécifié.

### Ce qui est vérifié

- **Pas de relaxation normative** : la spec dit `MUST`, le code dit « optional ». `readonly` retiré, champ `required` devenu `optional`, enum élargi sans justification. Si le mot « obligatoire », « DOIT », « requis » apparaît dans la spec à proximité et que le code l'ignore → bloquant.
- **Pas de modification silencieuse d'API publique** : un type exporté depuis le barrel public a été modifié sans nouveau document de design. Breaking change caché derrière un « alignement ».
- **Pas d'incohérence cross-spec** : un type est déclaré dans deux specs différentes, une seule a été modifiée → les sources de vérité divergent.
- **Le code s'aligne sur la spec, pas l'inverse** : si le code et la spec diffèrent, la spec est la source de vérité. Sauf décision explicite (nouveau document de design), on corrige le code, pas la spec.

### Si c'est raté

Dette normative, breaking change non documenté. Exemple : la spec dit qu'un champ est `readonly`, le code le rend mutable → tous les consommateurs qui comptaient sur l'immutabilité cassent silencieusement.

---

## 5. Backward Compatibility / Migration — « Est-ce que ça casse l'existant ? »

Le code évolue sans détruire ce qui existe. La différence avec Spec Conformance : la Spec vérifie l'alignement sur le contrat actuel, cette dimension vérifie la transition depuis l'ancien.

### Ce qui est vérifié

- **Données persistées** : si le format de `state.json`, d'un schema DB, d'un cache, ou d'un fichier de config change — y a-t-il une migration ? L'ancienne version peut-elle lire le nouveau format et inversement ? Un changement de shape sans migration transforme tous les fichiers existants en données corrompues au prochain démarrage.
- **Wire protocol / API versioning** : si une API HTTP, gRPC, ou WebSocket change, les anciens clients fonctionnent-ils encore ? Y a-t-il un versioning explicite ? Un endpoint supprimé ou renommé sans rétrocompatibilité casse silencieusement tous les consommateurs déployés.
- **Configuration** : une nouvelle clé de config obligatoire sans valeur par défaut casse tous les déploiements existants silencieusement. La config est-elle validée au démarrage ? Les clés inconnues ou invalides échouent-elles bruyamment ? Un changement de sémantique d'une clé existante (même nom, comportement différent) est pire qu'un changement de nom — il ne produit pas d'erreur, il produit un mauvais comportement.
- **Feature flags, kill switches et rollback** : le nouveau code peut-il coexister avec l'ancien pendant un déploiement progressif ? Existe-t-il un kill switch pour désactiver le nouveau chemin sans redéployer ? Son activation est-elle observable ? Si on rollback, l'ancien code peut-il fonctionner avec les données écrites par le nouveau ? Un déploiement irréversible est un risque opérationnel.

### Si c'est raté

Incident de déploiement. Exemple : un nouveau format de `state.json` est déployé → les instances avec l'ancien code ne peuvent plus lire le fichier → crash en boucle sur 50% du cluster. Ou : une clé de config `timeout` change de sémantique (secondes → millisecondes) → les timeouts passent de 30s à 30ms → avalanche de failures.

---

## 6. Build / CI / Reproducibility — « Est-ce que ça marche depuis zéro ? »

Le changement est reproductible depuis un checkout propre. Il ne dépend pas de l'état sale du workspace, d'un cache local, d'un fichier généré oublié, ou d'une commande que seule l'IA a exécutée.

### Ce qui est vérifié

- **Clean checkout** : le projet build-t-il après un clone propre, une installation propre, et sans fichiers non trackés ? Un test qui passe uniquement parce qu'un artefact local traîne dans le workspace ne vaut rien.
- **Lockfiles et dépendances** : les lockfiles sont-ils à jour avec les manifests ? Une dépendance ajoutée dans `package.json`, `pyproject.toml`, `go.mod`, ou équivalent est-elle réellement installable par CI ? Les versions sont-elles assez contraintes pour éviter un comportement différent demain ?
- **Artefacts générés** : les fichiers générés, snapshots, clients API, schémas, migrations, ou bindings ont-ils été régénérés quand la source a changé ? Un fichier généré stale est une divergence entre vérité et build.
- **Parité local / CI** : les commandes locales et CI vérifient-elles la même chose ? Une suite qui passe localement avec des variables d'environnement implicites, mais échoue en CI, cache une dépendance non déclarée.
- **Scripts déterministes** : les scripts de build/test dépendent-ils de l'heure, de l'ordre du filesystem, du réseau, d'un cache global, ou d'un outil installé hors projet ? Un build reproductible doit produire le même résultat avec les mêmes inputs.

### Si c'est raté

Le code marche sur la machine de l'agent et casse partout ailleurs. Exemple : un fichier généré non versionné est importé par le code → les tests passent dans le workspace courant, mais un clone propre échoue au premier `import`. Ou : le lockfile n'est pas mis à jour → CI installe une version différente de la librairie et le comportement diverge.

---

## 7. Tests — Substance — « Les tests qu'on a sont-ils vrais ? »

La suite de tests existante apporte une confiance réelle, pas une illusion de couverture.

### Ce qui est vérifié

- **Pas de test tautologique** : assertion qui passe toujours (`expect(true).toBe(true)` déguisé), mock trop permissif qui accepte tout sans vérifier les arguments, test qui vérifie l'implémentation plutôt que le comportement.
- **Résistance aux mutations** : si je supprime silencieusement la ligne de code testée, le test échoue-t-il ? Si je remplace la valeur de retour par une constante, le test passe-t-il quand même ? Un test qui survit à une mutation triviale du code qu'il prétend tester n'a aucune valeur probatoire.
- **Pas de redondance** : deux tests avec le même corps modulo un nom de variable. Tests paramétrés où le paramètre n'est jamais utilisé dans l'assertion. Redondance qui gonfle artificiellement la confiance sans ajouter d'information.
- **Pas d'absence d'assertion** : test qui appelle la fonction mais n'assert rien, `try/catch` qui masque les échecs d'assertion, test dont le succès ne dépend pas du comportement de la fonction testée.

### Si c'est raté

Confiance injustifiée. Exemple : 30 tests passent tous, mais ils vérifient uniquement que la fonction ne throw pas — aucun n'assert de résultat. La couverture affiche 100%, le code peut être complètement faux.

---

## 8. Tests — Coverage — « A-t-on tous les tests qu'il faut ? »

Au-delà de la qualité des tests existants : est-ce que les bons types de tests sont présents, aux bonnes couches, en quantité suffisante ?

### Ce qui est vérifié

- **Tests unitaires** : les fonctions pures, la logique métier, les edge cases isolés sont-ils testés unitairement ? Une fonction de calcul critique sans test unitaire est un trou dans le filet.
- **Tests d'intégration** : les interactions entre modules, les appels DB, les I/O fichiers sont-ils testés ? Un bug d'interaction entre deux modules tous deux testés unitairement ne sera pas détecté sans intégration.
- **Tests de compliance / contrat** : les invariants de spec, les règles normatives (`MUST`, `DOIT`, « obligatoire ») sont-ils vérifiés par des tests dédiés ? Si la spec dit « ce champ est obligatoire », y a-t-il un test qui échoue quand on l'enlève ?
- **Tests end-to-end** : le chemin utilisateur complet fonctionne-t-il ? Un bug d'intégration entre 3 modules tous testés unitairement et en intégration par paires ne sera pas détecté sans E2E.
- **Chemins critiques** : les hot paths, les flows money/sécurité, les garanties de durabilité sont-ils testés ? Un crash entre deux syscalls est-il simulé ?
- **Chemins d'erreur** : les cas d'échec sont-ils testés, pas seulement le happy path ? Si le réseau est down, si la DB est indisponible, si le fichier est verrouillé — que se passe-t-il et est-ce testé ?
- **Propriétés** : les invariants globaux (idempotence, convergence, pas de perte, ordre garanti) sont-ils vérifiés par des property-based tests ? Un test paramétré n'est pas un property test — le premier vérifie des exemples, le second vérifie une loi.

### Si c'est raté

Confiance de surface. Tous les tests passent, la couverture affiche 85%, mais personne n'a testé ce qui se passe quand la DB est down — et c'est là que le bug se déclenche en prod. Ou pire : les tests unitaires sont parfaits, les tests d'intégration n'existent pas, et le bug est dans le contrat entre deux modules.

---

## 9. Interface — « Est-ce que ça s'intègre ? »

Le code ne casse rien autour de lui et s'utilise correctement par ses consommateurs.

### Ce qui est vérifié

- **Pas de leak d'implémentation** : détail interne exposé dans l'API publique. Le consommateur ne devrait pas avoir à connaître les structures internes pour utiliser l'API.
- **API robuste** : paramètres optionnels dont l'absence produit un comportement surprenant, retours de types incohérents entre cas normal et cas d'erreur, signature ambiguë qu'un consommateur va forcément mal interpréter.
- **Sémantique d'erreur stable** : les erreurs sont-elles typées, documentées, et distinguables par les consommateurs ? Un appelant peut-il savoir ce qui est retryable, fatal, invalide, non autorisé, ou temporairement indisponible ? Les codes d'erreur, exceptions, statuts HTTP, et messages publics sont-ils stables ?
- **Contrats d'usage explicites** : pagination, tri, limites, idempotency keys, cancellation, rate limits, et garanties d'ordre sont-ils exposés clairement quand l'API en a besoin ? Un consommateur ne devrait pas deviner les règles opérationnelles d'une interface.
- **Impact cross-module** : modification qui casse silencieusement un autre module, import indirect qui change de comportement, régression sur un invariant global (idempotence, ordre de pipeline). Pour chaque fonction publique modifiée : vérifier tous ses call sites.
- **Nommage qui ne ment pas** : le nom d'une fonction, variable ou type ne doit pas cacher un comportement surprenant. Une fonction nommée `processChunk` qui fait des appels réseau LLM ment — le consommateur l'appellera dans une boucle serrée en supposant qu'elle est locale et cheap.

### Si c'est raté

Cassure en aval, mauvaise utilisation. Exemple : changement de signature d'une fonction publique exportée → 12 call sites cassent à la compilation ou, pire, silencieusement au runtime.

---

## 10. Observabilité / Debuggabilité — « Quand ça casse, peut-on comprendre pourquoi ? »

Le code est instrumenté pour que les failures soient diagnosticables. La différence avec Robustness : Robustness empêche les crashs, Observabilité permet de les comprendre quand ils arrivent malgré tout.

### Ce qui est vérifié

- **Messages d'erreur informatifs** : un `throw new Error("invalid")` sans contexte (quel input ? quel état ? quel appel ?) rend le debug impossible. Chaque erreur doit porter assez de contexte pour que quelqu'un qui la lit dans un log à 3h du matin puisse diagnostiquer sans reproduire.
- **Traçabilité** : dans un pipeline, une chaîne de middlewares, ou un système distribué, peut-on retracer le chemin d'une requête ? Un `requestId` ou `correlationId` est-il propagé ? Si une erreur arrive au bout d'un pipeline de 8 étapes, peut-on savoir à quelle étape elle est née ?
- **Logs structurés et exploitables** : les logs sont-ils exploitables par un humain ET par un outil (JSON structuré vs. free text avec concaténation de strings) ? Les niveaux de log (debug, info, warn, error) sont-ils utilisés avec discernement, ou tout est-il loggé au même niveau ?
- **Métriques opérationnelles** : les compteurs, latences, et taux d'erreur critiques sont-ils exposés ? Si un service se dégrade progressivement (latency creep, error rate qui monte), est-ce visible avant que ça devienne un incident ?
- **Pas d'erreur silencieuse** : `catch (e) {}` — l'erreur est attrapée et jetée dans le vide. `console.log(err)` au lieu de `console.error(err)` — l'erreur est noyée dans le bruit. `.catch(() => null)` — l'échec est transformé en succès. Chaque erreur silencée est un bug futur rendu invisible.

### Si c'est raté

5 heures de debug au lieu de 5 minutes. Exemple : un service retourne des 500 intermittents. Les logs disent `"Error: failed"`. Aucun request ID, aucun contexte, aucune stack trace. L'équipe passe une nuit à reproduire ce qu'un message d'erreur correct aurait montré en une ligne.

---

## 11. Structure — « Est-ce que c'est bien construit ? »

Le code est sain, maintenable, sans dette technique évitable. Cette dimension est rarement bloquante seule, mais elle peut le devenir quand la dette rend le code inreviewable ou inmodifiable.

### Ce qui est vérifié

- **Pas de duplication** : même logique dans deux fichiers différents, même bloc copié-collé dans le même fichier. Une duplication corrigée dans une copie mais pas l'autre est une régression garantie.
- **Pas de code mort** : fonctions, variables, exports, imports jamais utilisés. Augmente la surface de maintenance pour zéro valeur.
- **Review de suppression** : qu'est-ce qui peut être retiré ? Dead feature flags, shims de compatibilité obsolètes, tests pour du code supprimé, docs devenues fausses, branches mortes, configs inutilisées. L'IA ajoute facilement ; elle supprime rarement ce que son changement rend inutile.
- **Pas de fichier obèse** : fichier qui dépasse un seuil raisonnable sans découpage en responsabilités distinctes. Un fichier de 800 lignes qui fait 5 choses différentes est plus difficile à comprendre, tester, et modifier qu'un fichier de 800 lignes qui fait une seule chose bien — mais le premier cas est un problème structurel.
- **Local reasoning** : peut-on comprendre la fonction, le module, ou le changement sans charger six fichiers dans sa tête ? Les responsabilités sont-elles proches du code qui les utilise ? Les invariants importants sont-ils visibles au point où ils comptent ?
- **Pattern cohérent** : la première fonction du fichier gère les erreurs d'une certaine manière, la suivante fait autrement sans justification. Imbrication excessive, fonction qui fait plusieurs choses sans que son nom le reflète.
- **Documentation du « pourquoi »** : les décisions non triviales sont-elles commentées (le « pourquoi », pas le « quoi ») ? Un `// HACK:` ou `// WORKAROUND:` est-il accompagné d'un lien vers l'issue ? Les invariants implicites sont-ils documentés ? (« Cette fonction assume que le tableau est trié », « Ce lock doit être pris avant d'appeler X »). Sans ça, le prochain développeur (humain ou IA) va casser l'invariant parce qu'il ne le connaît pas. L'IA génère beaucoup de code, rarement du contexte.

### Si c'est raté

Dette technique cumulative. Exemple : même fonction `normalizePath` dupliquée dans 4 fichiers → corrigée dans 3, la 4ème copie reste buggée pendant des mois. Ou : un invariant non documenté (« les items doivent être triés avant l'appel ») est violé 6 mois plus tard par un développeur qui ne le connaît pas → bug silencieux en production.

---

## 12. Simplicity / Sobriety — « Est-ce que c'est aussi simple que ça devrait l'être ? »

Le code résout le problème sans en créer de nouveaux par excès de zèle. Cette dimension est spécifiquement ciblée sur les patterns de « AI sloppiness » — des tics que l'IA reproduit mécaniquement et qu'un humain ne produirait pas (ou moins).

### Ce qui est vérifié

- **Abstraction justifiée** : chaque interface, classe abstraite, factory, ou pattern a-t-elle au moins deux utilisations concrètes ? Une interface avec une seule implémentation, une factory pour instancier une classe concrète, un pattern Visitor pour un switch de 3 cas — ce n'est pas de l'architecture, c'est de la bureaucratie.
- **Solution proportionnée** : le problème justifie-t-il la complexité de la solution ? Une regex de 80 caractères pour parser un format qui avait un parser natif, une librairie externe pour une opération triviale, une chaîne de middlewares pour 2 transformations linéaires.
- **Pas de gold-plating** : tout ce qui est dans le code a-t-il été demandé ou est-ce strictement nécessaire ? Système de logging sur une fonction de 10 lignes, métriques, retry, circuit breaker « au cas où ». Ce qui n'a pas été demandé et n'est pas nécessaire est du bruit.
- **Pas de sur-validation défensive** : valider des entrées que le type system garantit déjà (`if (typeof x !== "string")` après `x: string`), try/catch autour d'opérations qui ne peuvent pas échouer, null checks en cascade sur des valeurs qui viennent d'être assignées. Le type system est un outil, pas un ennemi.
- **Pas de fausse consistance** : appliquer le même pattern à toutes les fonctions d'un fichier sans discernement (« tout est async donc cette fonction pure le devient aussi », « tout passe par un builder donc cette constante aussi »). Uniformité mécanique ≠ cohérence. La cohérence est un choix ; l'uniformité est un réflexe.
- **Rangement intentionnel** : chaque fonction, type, ou constante est dans le bon fichier, pas dans un bucket fourre-tout (`utils.ts`, `helpers.ts`, `common.ts`). Les buckets sont des refuges pour le code dont on ne sait pas quoi faire — ils ne devraient pas exister.
- **Pas d'inertie architecturale** : l'IA reçoit un codebase qui utilise le pattern X → elle continue le pattern X partout, même là où il n'a pas de sens. Le code existant est un artefact historique, pas une contrainte absolue. Remettre en question la structure héritée est légitime.
- **Choix de dépendances** : chaque lib externe est-elle justifiée ? La fonctionnalité existe-t-elle nativement dans le langage ou le runtime ? Si la lib est utilisée pour 2% de ses features, est-ce que ça vaut la dépendance ? Si la fonction fait moins de 50 lignes, aurait-elle pu être écrite ? La dépendance remplace-t-elle un comportement qui différencie le produit (cœur de métier) ? Enfin, quelle est la santé de la dépendance : dernière release, nombre de mainteneurs, dépendances transitives, licence ? Une dépendance non justifiée est une dette de maintenance, un risque supply chain, et un point de rupture — la `left-pad` de 2016 a prouvé qu'une lib de 11 lignes pouvait casser des milliers de builds.

### Si c'est raté

Surcharge cognitive et complexité accidentelle. Exemple : une fonction de 15 lignes qui calcule une remise se retrouve avec une interface `DiscountStrategy`, une factory `DiscountStrategyFactory`, une chaîne de middlewares, et un fichier de config JSON — pour une règle métier qui tient en un `if`. Le code marche, mais personne ne veut le maintenir.

---

## 13. Compliance / Licensing / Provenance / Supply Chain — « Est-ce légalement et opérationnellement propre ? »

Le code et ses dépendances respectent les contraintes légales, de provenance, et de supply chain. Cette dimension est particulièrement pertinente quand l'IA génère du code, car elle peut reproduire des fragments de code open-source sous licence incompatible sans le signaler, ou ajouter une dépendance risquée sans comprendre son origine.

### Ce qui est vérifié

- **Licence des dépendances** : chaque dépendance ajoutée a-t-elle une licence compatible avec le projet ? Une dépendance GPL dans un projet MIT est une violation de licence. Une dépendance avec une licence ambiguë ou absente est un risque juridique.
- **Code généré par l'IA et provenance** : l'IA a-t-elle reproduit un fragment identifiable d'un projet open-source sous licence restrictive ? Un bloc de code copié-collé depuis un projet GPL contamine le projet hôte. Si le code ressemble suspicieusement à un extrait connu (algorithme très spécifique, commentaires originaux conservés, structure identique), vérifier la provenance.
- **Dépendances transitives** : la dépendance directe est sous licence MIT, mais sa dépendance transitive est sous licence AGPL ? Les licences se propagent dans le graphe de dépendances — une seule feuille restrictive contamine l'arbre.
- **Supply chain adversariale** : la dépendance est-elle le bon package, pas un typosquat ? A-t-elle des scripts d'installation dangereux, un mainteneur compromis, une release récente suspecte, ou une dépendance transitive inattendue ? Les versions et intégrités sont-elles pinées par un lockfile fiable ? Une dépendance sûre juridiquement peut rester dangereuse opérationnellement.
- **Données et modèles** : si le code embarque des données (datasets, modèles ML, fichiers de config pré-remplis), sont-elles sous une licence compatible ? Les datasets ont leurs propres licences, souvent plus restrictives que le code.

### Si c'est raté

Risque juridique ou supply chain. Exemple : une lib ajoutée par l'IA pour parser du YAML est sous licence GPL → le projet entier doit passer en GPL ou retirer la dépendance. Découvert 6 mois après, 40 modules en dépendent, le retrait coûte 3 semaines. Ou : un package au nom presque identique au package attendu exécute un script d'installation malveillant.

---

## Sévérité des findings

Chaque finding de review a un niveau de sévérité qui détermine s'il bloque le merge :

| Sévérité       | Définition                                                                                        | Action             |
|----------------|---------------------------------------------------------------------------------------------------|--------------------|
| **Bloquant**   | Bug, faille, corruption, breaking change non documenté, test qui ment. Ne peut pas aller en prod. | Merge interdit     |
| **Majeur**     | Dette technique significative, absence de test sur un chemin critique, observabilité absente.      | Merge conditionnel |
| **Mineur**     | Amélioration structurelle, nommage améliorable, duplication locale, documentation manquante.       | Merge autorisé     |
| **Suggestion** | Préférence stylistique, refactoring opportuniste, pattern alternatif équivalent.                   | Informatif         |

Une review « hostile » qui flag tout au même niveau produit du bruit et de la fatigue de review.
La sévérité est un outil de tri — elle force le reviewer à distinguer ce qui est dangereux de ce qui est perfectible.

Tout finding **bloquant** doit nommer l'invariant violé et donner une reproduction minimale. Sans invariant explicite, le finding devient une préférence. Sans reproduction minimale, il devient difficile à corriger et à vérifier.

---

## Tableau récapitulatif

| #  | Dimension                        | Question                            | Si c'est raté                    |
|----|----------------------------------|-------------------------------------|----------------------------------|
| 1  | **Correctness**                  | Ça marche ?                         | Bug en production                |
| 2  | **Robustness**                   | Ça tient ?                          | Crash, corruption, fuite         |
| 3  | **Security**                     | C'est protégé ?                     | Faille exploitable               |
| 4  | **Spec Conformance**             | Ça respecte le contrat ?            | Dette normative, breaking change |
| 5  | **Backward Compat / Migration**  | Ça casse l'existant ?               | Incident de déploiement          |
| 6  | **Build / CI / Reproducibility** | Ça marche depuis zéro ?             | Build non reproductible          |
| 7  | **Tests — Substance**            | Les tests sont-ils vrais ?          | Confiance injustifiée            |
| 8  | **Tests — Coverage**             | A-t-on tous les tests qu'il faut ?  | Confiance de surface             |
| 9  | **Interface**                    | Ça s'intègre ?                      | Cassure en aval                  |
| 10 | **Observabilité**                | Peut-on comprendre les failures ?   | 5h de debug au lieu de 5min      |
| 11 | **Structure**                    | C'est bien construit ?              | Dette technique                  |
| 12 | **Simplicity / Sobriety**        | C'est aussi simple que ça devrait ? | Surcharge cognitive              |
| 13 | **Compliance / Supply Chain**    | Légal et supply chain ?             | Risque juridique/supply chain    |

---

## Ordre de priorité

La review s'exécute dans cet ordre, du plus critique au moins urgent :

```
Correctness → Robustness → Security → Spec Conformance → Backward Compat
→ Build / CI / Reproducibility → Tests (Substance) → Tests (Coverage)
→ Interface → Observabilité → Structure → Simplicity → Compliance
```

Chaque dimension dépend de la précédente. Un bug de correctness ou une faille de sécurité rendent la vérification de la spec secondaire.

Backward Compatibility est placé immédiatement après Spec Conformance : les deux concernent le contrat, l'un dans le présent, l'autre dans la transition.

Build / CI / Reproducibility est placé avant les tests : si le changement ne s'installe pas ou ne build pas depuis zéro, les tests ne prouvent que l'état local du workspace.

Compliance est placé en dernier : c'est un risque réel mais largement vérifiable indépendamment du reste.

---

## Passe transversale — AI Artifact Detection

Cette passe n'est pas une quatorzième dimension. Elle s'applique à toutes les dimensions précédentes et cible les pathologies spécifiques du code généré par IA : le code plausible, cohérent en surface, mais faux dans le détail.

### Ce qui est vérifié

- **APIs hallucinated** : méthode, flag CLI, option de config, variable d'environnement, endpoint, event, ou feature de librairie qui semble plausible mais n'existe pas.
- **Commentaires qui mentent** : commentaire, docstring, README, ou message d'erreur qui affirme un comportement que le code n'implémente pas réellement.
- **Docs alignées sur le faux code** : documentation mise à jour pour correspondre à une implémentation incorrecte au lieu de préserver la spec, le design, ou le comportement attendu.
- **Idiomes du mauvais écosystème** : patterns Java écrits en TypeScript, code Python qui ignore les conventions Python, architecture web appliquée à un CLI local, abstractions copiées d'un framework absent.
- **Implémentations plausibles mais dangereuses** : regex maison pour un format standard, parser ad hoc, crypto custom, logique de timezone, concurrence, cache invalidation, ou escaping qui a l'air raisonnable mais ne respecte pas les règles du domaine.
- **Fallbacks trop confiants** : branche de secours qui transforme une erreur réelle en succès silencieux, invente une valeur par défaut, ou masque une incapacité du code à traiter le cas demandé.

### Si c'est raté

Le code a l'air professionnel mais repose sur une fiction. Exemple : l'IA appelle une option `--json-output` qui n'existe pas dans l'outil cible, puis ajoute un test avec un mock qui accepte cette option. Tout est vert, rien ne fonctionne dans le vrai runtime.

---

## Référence

Ce document est dérivé du système `loop-clean` (~/.claude/skills/loop-clean/) et de ses sub-agents associés, notamment `senior-review-file` (12 axes) et `coding-standards-file` (6 axes). Il en extrait l'essence, puis l'étend à 13 dimensions et une passe transversale IA sans dépendre d'une implémentation spécifique.

Voir aussi `go-pipeline-contract.md` pour la forme exécutable des findings,
leurs sévérités canoniques, les gates humaines, et les règles de transition du
pipeline `/go`.
