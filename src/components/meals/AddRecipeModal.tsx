import { useState } from "react"
import { ScrollView } from "react-native"
import { Button, Card, Text, Modal, TextInput } from "react-native-paper"
import { styles } from "@/constants/styles"
import { VStack } from "../ui/vstack"
import { HStack } from "../ui/hstack"
import type { Ingredient } from "@/lib/meals/meals"
import { IngredientPicker } from "./IngredientPicker"

type RecipeIngredientInput = {
    ingredient_id: string,
}

export type CreateRecipeInput = {
    name: string,
    prep_time_min: number,
    ingredients: RecipeIngredientInput[],
}

type AddRecipeModalProps = {
    visible: boolean,
    availableIngredients: Ingredient[],
    onDismiss: () => void,
    onCreate: (input: CreateRecipeInput) => void | Promise<void>
}


export function AddRecipeModal({
    visible,
    availableIngredients,
    onDismiss,
    onCreate
}: AddRecipeModalProps) {
    const [name, setName] = useState("")
    const [prepTime, setPrepTime] = useState("1")
    const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
    const [error, setError] = useState("")
    
    const handleDismiss = () => {
        setError("")
        onDismiss()
    }    

    const toggleIngredient = (ingredient: Ingredient) => {
        setSelectedIds((cur) => {
            const next = new Set(cur)
            if (next.has(ingredient.id)) next.delete(ingredient.id)
            else next.add(ingredient.id)
            return next
        })
    }
    const handleCreate = async () => {
        const trimmedName = name.trim()
        const ingredientIds = Array.from(selectedIds)

        if (!trimmedName) {
            setError("Please enter a recipe name.")
            return
        }

        if (ingredientIds.length === 0) {
            setError("Please select at least one ingredient.")
            return
        }

        const availableIds = new Set(availableIngredients.map((ing) => ing.id))
        const hasUnknownIngredient = ingredientIds.some((id) => !availableIds.has(id))

        if (hasUnknownIngredient) {
            setError("One or more selected ingredients are no longer available.")
            return
        }

        const prepTimeMin = Number(prepTime.trim())
        if (
            !prepTime.trim() ||
            !Number.isFinite(prepTimeMin) ||
            !Number.isInteger(prepTimeMin) ||
            prepTimeMin <= 0
        ) {
            setError("Prep time must be a positive whole number.")
            return
        }

        const input: CreateRecipeInput = {
            name: trimmedName,
            prep_time_min: prepTimeMin,
            ingredients: ingredientIds.map((id) => ({
                ingredient_id: id
            }))
        }

        try {
            setError("")
            await onCreate(input)
            setName("")
            setPrepTime("1")
            setSelectedIds(new Set())
            onDismiss()
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Could not create the recipe.",
            )
        }
    }

    return (
        <Modal
            visible={visible}
            onDismiss={handleDismiss}
            contentContainerStyle={styles.modalContent}
        >
            <Card mode="contained" style={styles.modalCard}>
                <Card.Title title={<Text variant="titleLarge">New Recipe</Text>} />
                <Card.Content style={styles.stepContainer}>
                    <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
                        <VStack space="md" style={{ alignSelf: "stretch" }}>
                            {error.length > 0 && (
                                <Text style={{ color: "#ff4d4f" }}>{error}</Text>
                            )}
                            <TextInput
                                label="Recipe name"
                                mode="outlined"
                                value={name}
                                onChangeText={setName}
                            />
                            <TextInput
                                label="Prep time"
                                mode="outlined"
                                value={prepTime}
                                onChangeText={setPrepTime}
                                keyboardType="number-pad"
                            />
                            <Text variant="labelLarge">Ingredients</Text>
                            <IngredientPicker
                                ingredients={availableIngredients}
                                selectedIds={selectedIds}
                                onToggle={toggleIngredient}
                            />
                        </VStack>
                    </ScrollView>
                </Card.Content>
                <Card.Actions>
                    <HStack style={styles.rowBox}>
                        <Button onPress={handleDismiss}>Cancel</Button>
                        <Button mode="contained" onPress={handleCreate}>Create</Button>
                    </HStack>
                </Card.Actions>
            </Card>

        </Modal>
    )
}