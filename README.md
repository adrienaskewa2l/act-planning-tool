# Gestionnaire d'evenements - SOS Lyon

Outil local pour creer et gerer plusieurs evenements, chacun avec son planning interactif, ses exports et ses donnees propres.

## Lancer l'application

```bash
cd "/Users/adrienaskew/Desktop/act-planning-tool"
python3 planning_app.py
```

Puis ouvrir `http://localhost:5001`.

## Organisation des donnees

- `events_index.json` contient la liste des evenements disponibles sur la page d'accueil.
- `events/<event-id>.json` contient le planning complet de chaque evenement.
- `ACT Conference 2026` devient l'evenement `act-conference-2026` dans le gestionnaire.

## Ce que l'outil permet

- Creer plusieurs evenements depuis une page d'accueil
- Ouvrir un evenement en consultation ou en gestion
- Modifier le contenu d'un bloc
- Changer l'heure et la duree
- Glisser un bloc pour changer son horaire
- Redimensionner un bloc pour ajuster sa duree
- Changer la couleur et le type
- Saisir les equipes responsables distinctement
- Ajouter des details pour la Running Sheet
- Mettre a jour les infos generales de l'evenement
- Exporter une Running Sheet `.docx`
- Exporter le planning en PDF couleur, en entier ou par sélection visuelle d'événements

## Sauvegarde

- Chaque evenement est sauvegarde dans son propre fichier JSON sous `events/`.
- `schedule_data.json` reste un miroir de compatibilite pour `act-conference-2026`.
- La Running Sheet et le PDF planning sont generes a la demande depuis le navigateur.

## Donnees de planning et deploiement

- Les donnees vivantes du gestionnaire sont dans `events_index.json` et `events/`.
- Sur Render, utiliser un stockage persistant et definir la variable d'environnement `SCHEDULE_DATA_FILE`, par exemple `/var/data/schedule_data.json`.
- Sans stockage persistant Render, versionner aussi `events_index.json`, `events/` et `schedule_data.json` pour que chaque redeploiement embarque la derniere version connue.
