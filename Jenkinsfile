pipeline {
    agent any

    stages {
        stage('Code Checkout') {
            steps {
                echo 'Checking out latest source code from Git repository...'
            }
        }

        stage('Build Docker Images') {
            steps {
                echo 'Building backend and frontend Docker containers...'
                sh 'docker compose build'
            }
        }

        stage('Deploy Application') {
            steps {
                echo 'Orchestrating multi-container deployment via Docker Compose...'
                sh 'docker compose down'
                sh 'docker compose up -d'
            }
        }

        stage('Verify Containers') {
            steps {
                echo 'Verifying running containers...'
                sh 'docker ps'
            }
        }
    }

    post {
        success {
            echo 'Deployment successful! Application is live.'
        }
        failure {
            echo 'Deployment failed! Check Jenkins build logs.'
        }
    }
}
