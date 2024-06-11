# Automatisation de la publication d’articles sur Webflow

## Description

Ce projet permet d'automatiser la publication d'articles sur Webflow en suivant les étapes suivantes :

1. **Récupération des nouveaux articles** : Scraping de sites tiers pour obtenir de nouveaux articles.
2. **Reformulation du contenu** : Utilisation de GPT d'OpenAI pour reformuler le titre et le contenu de l’article.
3. **Génération d’images de couverture** : Création d'images de couverture avec DALL-E d'OpenAI.
4. **Publication sur Webflow** : Publication automatique de l'article reformulé sur Webflow.

## Configuration

1. **Créez un fichier `.env`** avec les champs suivants :

   ```plaintext
   OPENAI_API_KEY="YOUR_API_KEY"
   WEBFLOW_API_KEY="YOUR_API_KEY"
   ```

2. **Modifiez les variables suivantes selon vos besoins :**

   - `TESTING_MODE` : Si `true`, alors un seul article sera traité pour tester.
   - `WEBFLOW_BLOG_COLLECTION_ID` : L’ID de la collection Webflow contenant les articles.
   - `WEBFLOW_BLOG_ORIGINAL_LINK_FIELD` : Le slug du champ contenant les liens originaux des articles (à ajouter dans la collection Webflow).
   - `OPENAI_GPT_MODEL` : Le modèle GPT à utiliser pour reformuler les textes.

3. **Ajoutez un ou plusieurs sites tiers à scraper dans `BLOG_SITES`** :

   ```json
   [
     {
       "id": "unique_site_identifier",
       "name": "Nom du Site",
       "domain": "nom-de-domaine.com",
       "blogPageUrl": "https://nom-de-domaine.com/blog",
       "blogPageLinkSelector": ".article-link",
       "postPageTitleSelector": ".article-title",
       "postPageHtmlContentSelector": ".article-content"
     }
   ]
   ```

   ### Explications des champs `BLOG_SITES`

   - `id` : Identifiant unique du site.
   - `name` : Nom du site tiers.
   - `domain` : Nom de domaine du site tiers.
   - `blogPageUrl` : URL de la page générale affichant la liste de tous les nouveaux articles.
   - `blogPageLinkSelector` : Sélecteur CSS des balises contenant les liens href applicables pour chaque article sur la page.
   - `postPageTitleSelector` : Sélecteur CSS de la balise contenant le titre de l’article sur sa page.
   - `postPageHtmlContentSelector` : Sélecteur CSS des balises contenant le contenu de l’article sur sa page.

## Installation

1. **Clonez le projet :**

   ```sh
   git clone https://github.com/username/repository.git
   ```

2. **Accédez au répertoire du projet :**

   ```sh
   cd repository
   ```

3. **Installez les dépendances :**
   ```sh
   pnpm install
   ```

## Utilisation

Pour lancer le script, utilisez la commande suivante :

```sh
ts-node index.ts
```
