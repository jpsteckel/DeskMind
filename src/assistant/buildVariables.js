/**
 * Maps a client database record to the AIAssistantDynamicVariables object
 * expected by the Telnyx start_ai_assistant API call.
 *
 * This is the single translation layer between your DB schema and the
 * {{variable_name}} placeholders in your Telnyx assistant template.
 * When you add a new variable to the assistant, update it here only.
 *
 * @param {object} client - A client row from Supabase.
 * @returns {object} Dynamic variables object ready to pass to Telnyx.
 */
export function buildVariables(client) {
  const now = new Date();
  const currentDateTime = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  return {
    // Core identity
    number:              client.number,
    business_name:       client.business_name,
    assistant_name:      client.assistant_name   ?? 'Alex',
    tone:                client.tone             ?? 'friendly and professional',
    language:            client.language         ?? 'English',
    current_day_time:    currentDateTime,

    // Instruction customization — empty string if not set so the placeholder
    // resolves to nothing rather than appearing raw in the prompt
    custom_instructions: client.custom_instructions ?? '',
    topics_off_limits:   client.topics_off_limits   ?? '',

    // Call handling
    transfer_number:     client.transfer_number  ?? '',
    transfer_trigger:    client.transfer_trigger ?? 'if the caller requests a manager or becomes upset',
    hours_of_operation:  client.hours ?? 'during business hours',
    voicemail_message:   client.voicemail_message  ?? '',

    // Business-specific knowledge
    address:             client.address           ?? '',
    city:                client.city              ?? '',
    state:               client.state             ?? '',
    zip:                 client.zip              ?? '',

    services_offered:    client.service_types ?? '',
    faq_blob:            client.faq_blob          ?? '',
  };
}