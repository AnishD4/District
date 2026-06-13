import { supabase } from '../index.js'

/**
 * Builds a rich system prompt for Gemini by aggregating all content
 * in a building (rooms, files) plus cross-references to other buildings.
 */
export async function buildBuildingContext(buildingId) {
  const { data: building } = await supabase
    .from('buildings')
    .select(`*, rooms(*, files(name, content))`)
    .eq('id', buildingId)
    .single()

  // Aggregate all file content (Gemini 1.5 Pro handles 500k tokens)
  const fileContent = building.rooms
    .flatMap(r => r.files)
    .filter(f => f.content)
    .map(f => `--- FILE: ${f.name} ---\n${f.content}`)
    .join('\n\n')

  // Get all building names for cross-reference suggestions
  const { data: allBuildings } = await supabase.from('buildings').select('id, name')
  const buildingList = allBuildings.map(b => b.name).join(', ')

  return `You are the AI assistant for "${building.name}" in AI City.
Building type: ${building.type}
District: This building's project category

Other buildings in the city: ${buildingList}

You have access to the following files and notes:
${fileContent || '[No files yet — help the user add content to this building]'}

Guidelines:
- Answer questions about this project specifically
- When you see connections to other buildings by name, mention them explicitly
- Be concise, direct, and technically precise
- If you mention another building, preface it with "→ [Building Name]" so the UI can detect it`
}
