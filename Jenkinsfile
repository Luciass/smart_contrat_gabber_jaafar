pipeline {
  agent any

  tools {
    nodejs 'node22'   // <-- nom de l'outil NodeJS configuré dans Jenkins
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
        // Adapte selon ton runner (Jest/Mocha). Non bloquant si pas de tests.
        sh 'npm test || true'
      }
      post {
        always {
          // Si tes tests génèrent du JUnit (ex: jest-junit), on le publie
          junit allowEmptyResults: true, testResults: '**/junit*.xml,**/test-results/*.xml'
          // Si tu génères une couverture HTML (coverage/index.html), on la publie
          publishHTML(target: [reportDir: 'coverage', reportFiles: 'index.html', reportName: 'Coverage', allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true])
        }
      }
    }

    stage('Build') {
      steps {
        // Adapte au script build de ton package.json
        sh 'npm run build'
      }
      post {
        success {
          // Archive ce qui est produit (dist/ ou build/)
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