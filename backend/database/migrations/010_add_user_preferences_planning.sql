ALTER TABLE user_preferences
  ADD COLUMN monthly_hour_goal INT NULL AFTER notification_prefs,
  ADD COLUMN planning_preferences JSON NULL AFTER monthly_hour_goal;
