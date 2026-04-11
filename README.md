# ACT Planning Tool

Outil local pour transformer un deroule d'evenement en planning interactif puis generer une Running Sheet `.docx`.

## Lancer l'application

```bash
cd "/Users/adrienaskew/Desktop/act-planning-tool"
python3 planning_app.py
```

Puis ouvrir `http://localhost:5001`.

## Ce que l'outil permet

- Modifier le contenu d'un bloc
- Changer l'heure et la duree
- Glisser un bloc pour changer son horaire
- Redimensionner un bloc pour ajuster sa duree
- Changer la couleur et le type
- Saisir les equipes responsables distinctement
- Ajouter des details pour la Running Sheet
- Mettre a jour les infos generales de l'evenement
- Exporter une Running Sheet `.docx`

## Sauvegarde

- Le planning est sauvegarde dans `schedule_data.json`
- La Running Sheet est generee a la demande depuis le navigateur
