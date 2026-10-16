function validAutomatedStep(body, chat, settings) {
  const id = String(body.flowStepId || '');
  const flow = Array.isArray(settings.chatFlow) ? settings.chatFlow : [];
  const step = flow.find((item, index) => String(item.id || index) === id);
  if (!step || !id) return false;
  const firstName = chat.visitorName && chat.visitorName !== 'Visitante' ? chat.visitorName.trim().split(/\s+/)[0] : '';
  const expectedText = String(step.text || '').replace(/\{name\}/g, firstName).trim();
  const expectedAudio = step.kind === 'audio' ? String(step.audioUrl || '') : '';
  return expectedText === String(body.text || '').trim() && expectedAudio === String(body.audioUrl || '');
}

module.exports = { validAutomatedStep };
