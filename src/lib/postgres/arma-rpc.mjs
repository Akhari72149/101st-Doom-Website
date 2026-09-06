const signatures = {
  record_arma_xp_event: {
    p_event_uid: 'text', p_event_type: 'text', p_steam_id: 'text', p_xp_delta: 'integer',
    p_server_id: 'text', p_mission_id: 'text', p_occurred_at: 'timestamptz',
    p_target_category: 'text', p_target_class: 'text', p_target_display_name: 'text',
  },
  record_arma_medical_event: {
    p_event_uid: 'text', p_steam_id: 'text', p_medical_metric: 'text', p_medical_quantity: 'numeric',
    p_server_id: 'text', p_mission_id: 'text', p_occurred_at: 'timestamptz',
    p_medical_action: 'text', p_item_class: 'text', p_treatment_class: 'text',
    p_body_part: 'text', p_patient_steam_id: 'text',
  },
  reset_arma_xp_weekly_data: {},
};

export function armaRpcQuery(name, parameters = {}) {
  if (!Object.hasOwn(signatures, name)) throw new Error('Unsupported Arma database function');
  const signature = signatures[name];
  const entries = Object.entries(signature);
  if (Object.keys(parameters).length !== entries.length || entries.some(([key]) => !Object.hasOwn(parameters, key))) {
    throw new Error('Arma database function parameters do not match');
  }
  const argumentsSql = entries.map(([key, type], index) => `${key} => $${index + 1}::${type}`).join(', ');
  // JSON conversion preserves date/numeric response formatting used by PostgREST.
  return {
    text: `select to_jsonb(result) as value from public.${name}(${argumentsSql}) as result`,
    values: entries.map(([key]) => parameters[key]),
  };
}
