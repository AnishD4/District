import { supabase } from '../lib/supabase.js'

export async function buildBuildingContext(buildingId) {
  const { data: building, error } = await supabase
    .from('buildings')
    .select('*, rooms(*, files(name, content))')
    .eq('id', buildingId)
    .single()

  if (error || !building) {
    throw new Error(`Building not found: ${buildingId}`)
  }

  const fileContent = (building.rooms || [])
    .flatMap(room => room.files || [])
    .filter(file => file.content)
    .map(file => `--- FILE: ${file.name} ---\n${file.content}`)
    .join('\n\n')

  const { data: allBuildings } = await supabase.from('buildings').select('id, name')
  const buildingList = (allBuildings || []).map(building => building.name).join(', ')

  return `You are the AI assistant for "${building.name}" in District.
Building type: ${building.type}
District: This building's project category

Other buildings in the city: ${buildingList}

You have access to the following files and notes:
${fileContent || '[No files yet - help the user add content to this building]'}

Guidelines:
- Answer questions about this project specifically
- When you see connections to other buildings by name, mention them explicitly
- Be concise, direct, and technically precise
- If you mention another building, preface it with "-> [Building Name]" so the UI can detect it`
}
