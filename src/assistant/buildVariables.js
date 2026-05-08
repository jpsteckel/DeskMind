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
  return {
    // Core identity
    business_name:       client.business_name,
    assistant_name:      client.assistant_name   ?? 'Alex',
    tone:                client.tone             ?? 'friendly and professional',
    language:            client.language         ?? 'English',

    // Instruction customization — empty string if not set so the placeholder
    // resolves to nothing rather than appearing raw in the prompt
    custom_instructions: client.custom_instructions ?? '',
    topics_off_limits:   client.topics_off_limits   ?? '',

    // Call handling
    transfer_number:     client.transfer_number  ?? '',
    transfer_trigger:    client.transfer_trigger ?? 'if the caller requests a manager or becomes upset',
    hours_of_operation:  client.hours_of_operation ?? 'during business hours',
    voicemail_message:   client.voicemail_message  ?? '',

    // Business-specific knowledge
    address:             client.address           ?? '',
    services_offered:    client.services_offered  ?? '',
    faq_blob:            client.faq_blob          ?? '',

    // Integration endpoints (empty string disables the tool in the prompt)
    booking_webhook_url: client.booking_webhook_url ?? '',
    crm_webhook_url:     client.crm_webhook_url     ?? '',
  };
}