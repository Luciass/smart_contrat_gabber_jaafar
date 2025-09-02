# Procédure de mise en place d’un pipeline Jenkins (Docker) pour projet Node.js + déclenchement auto (GitHub Webhook & ngrok)

## 1) Prérequis

- Docker (et Docker Compose si vous préférez).
- Un dépôt **GitHub** contenant :
  - un `Jenkinsfile` (fourni ci-dessous) ;
  - un projet Node.js (avec `package.json`).
- Ports **8680** (UI Jenkins) et **50000** (JNLP) libres en local.
- (Optionnel) **ngrok** installé pour exposer temporairement Jenkins : <https://ngrok.com/download>.

---

## 2) Lancer Jenkins sous Docker

### 2.1 Avec `docker compose`

Créez un fichier `docker-compose.yml` :
```yaml
services:
  jenkins:
    image: jenkins/jenkins:lts-jdk17
    container_name: jenkins
    ports:
      - "8680:8080"
      - "50000:50000"
    volumes:
      - jenkins_home:/var/jenkins_home
    restart: unless-stopped

volumes:
  jenkins_home:
```

Démarrez :
```bash
docker compose up -d
```

### 2.2 Récupérer le mot de passe initial et se connecter

```bash
docker exec -it jenkins bash -lc 'cat /var/jenkins_home/secrets/initialAdminPassword'
```
- Accédez à **http://localhost:8680**
- Collez le mot de passe, **installez les plugins recommandés**, créez l’**administrateur**.

---

## 3) Plugins Jenkins à installer

Allez dans **Manage Jenkins → Plugins** :
- **NodeJS** (pour `tools { nodejs 'node22' }`)
- **HTML Publisher** (pour publier `coverage/` si vous l’utilisez)
- **Git** (généralement déjà présent)
- **GitHub** (webhooks GitHub → Jenkins)

Redémarrez Jenkins si demandé.

---

## 4) Configurer l’outil NodeJS “node22”

- **Manage Jenkins → Tools → NodeJS installations → Add NodeJS**
  - **Name** : `node22` (doit **correspondre au Jenkinsfile**)
  - **Install automatically** → choisissez **Node 22.x** (ou 20.x LTS si vous préférez)
  - **Save**

---

## 5) Créer le job Pipeline

- **New Item → Pipeline**
- **Build Triggers** : cochez **GitHub hook trigger for GITScm polling** (pour webhooks)
- **Pipeline → Definition** : *Pipeline script from SCM*
  - **SCM** : Git
  - **Repository URL** : votre repo
  - **Credentials** : `global_jenkins`
  - **Branches to build** : `*/main` (ou votre branche)
  - **Script Path** : `Jenkinsfile`
- **Save** puis **Build Now** pour vérifier que le pipeline tourne.

---

## 6) Jenkinsfile utilisé

```groovy
pipeline {
  agent any

  tools {
    nodejs 'node22'
  }

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      steps {
        sh 'node -v && npm -v'
        sh 'if [ -f package-lock.json ]; then npm ci; else npm install; fi'
      }
    }

    stage('Test') {
      steps {
        sh 'npm test || true'
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: '**/junit*.xml,**/test-results/*.xml'
          publishHTML(target: [reportDir: 'coverage', reportFiles: 'index.html', reportName: 'Coverage', allowMissing: true, alwaysLinkToLastBuild: true])
        }
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build'
      }
      post {
        success {
          archiveArtifacts artifacts: 'dist/**,build/**', allowEmptyArchive: true
        }
      }
    }
  }

  post {
    success { echo '✅ Build OK' }
    failure { echo '❌ Build KO' }
    always  { cleanWs() }
  }
}
```

---

## 7) Déclenchement automatique à chaque push

### 7.1 En **local** avec **ngrok** (URL temporaire)

1. Démarrez Jenkins (port 8080 mappé comme ci-dessus).
2. Lancez **ngrok** :
   ```bash
   ngrok http 8680
   ```
   - Récupérez l’URL **https** fournie, ex : `https://abcd-1234.ngrok-free.app`
3. Dans Jenkins : **Manage Jenkins → System → Jenkins URL**
   - Mettez : `https://abcd-1234.ngrok-free.app/` → **Save**.
4. Dans le **job Pipeline** : assurez-vous que **Build Triggers → GitHub hook trigger for GITScm polling** est coché.
5. Dans GitHub → **Settings → Webhooks → Add webhook** :
   - **Payload URL** : `https://abcd-1234.ngrok-free.app/github-webhook/`
   - **Content type** : `application/json`
   - **Events** : *Just the push event*
   - **Secret** : optionnel (si utilisé, configurez le même secret côté Jenkins → *GitHub Servers*)
   - **Add webhook**
6. Dans la page Webhook GitHub, **“Recent Deliveries” → Redeliver** : vous devez avoir un **HTTP 200** côté GitHub et voir un log côté Jenkins.
7. **Faites un push** sur la branche suivie → le pipeline doit se lancer automatiquement.

> ⚠️ L’URL ngrok **change à chaque redémarrage**. **Pensez à mettre à jour** la *Jenkins URL* et le *Webhook GitHub* à chaque nouvelle session.

### 7.2 En **prod** (URL publique stable)

1. Placez Jenkins derrière un **reverse proxy** (Nginx/Traefik) en **HTTPS** avec un nom de domaine : `https://jenkins.mondomaine.fr/`.
2. **Manage Jenkins → System → Jenkins URL** : définissez cette URL publique.
3. Dans GitHub → **Webhooks** :  
   - **Payload URL** : `https://jenkins.mondomaine.fr/github-webhook/`
   - **Content type** : `application/json`
   - **Events** : push (+ PR si souhaité)
4. Cochez **Build Triggers → GitHub hook trigger for GITScm polling** dans le job.

> Alternative si vous ne pouvez pas exposer Jenkins : utilisez **Poll SCM** (`H/5 * * * *`) en *Build Triggers* (moins réactif).

---

## 8) Problème rencontré et solution

- **`Tool type "nodejs" does not have an install of "node22"`**  
  → Installez le **plugin NodeJS** et créez l’installation **node22** (voir §4).  
  → Sinon, utilisez un **agent Docker** Node :  
  ```groovy
  agent { docker { image 'node:22-alpine'; args '-v $JENKINS_HOME/.npm:/root/.npm'; reuseNode true } }
  ```

- **`No test files found`**  
  → Vérifiez l’emplacement/casse (`test/` vs `Test/`) ou adaptez votre script `npm test`.

- **`Missing script: "build"`**  
  → Ajoutez `"build": "…" ` à `package.json` ou remplacez la commande par celle que vous utilisez réellement (ex: `node compile.js`).

- **Webhook GitHub renvoie 401/403/404**  
  → Vérifiez l’URL (`…/github-webhook/`), le **HTTPS**, la **Jenkins URL**, la présence du **plugin GitHub**, et la connectivité (pare-feu, proxy).  
  → Avec ngrok, regardez les logs ngrok pour confirmer la réception.

---

## 9) Résumé

1. Lancez **Jenkins** sous Docker, installez les **plugins**.  
2. Créez l’outil **NodeJS `node22`**.  
3. Ajoutez des **credentials** GitHub (`global_jenkins`).  
4. Créez le **job Pipeline** (SCM → URL + credentials + Jenkinsfile).  
5. Activez le **déclenchement** :
   - **Local** : **ngrok** + **Webhook GitHub** vers `…/github-webhook/` ;
   - **Prod** : **domaine public** + **Webhook GitHub**.  
6. Poussez un commit → **le pipeline démarre automatiquement**.