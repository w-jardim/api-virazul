UPDATE users
   SET payment_status = NULL,
       payment_due_date = NULL
 WHERE deleted_at IS NULL
   AND (
     role = 'ADMIN_MASTER'
     OR subscription IN (
       'free',
       'partner',
       'parceiro',
       'local',
       'preview',
       'inicial',
       'plan_free',
       'plan_partner'
     )
   );
