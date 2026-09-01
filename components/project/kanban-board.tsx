"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { CircleDashedIcon, GripVerticalIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FeatureStatusSelect } from "@/components/project/feature-status-select"
import { getFeatureRequirementIds } from "@/lib/feature-requirements-store"
import { FEATURE_STATUSES, isFeatureStatus, type FeatureStatus } from "@/lib/feature-status"
import { getFeatureStatusDisplay } from "@/lib/feature-status-display"
import { cn } from "@/lib/utils"

interface Feature {
  id: string
  name: string
  description: string | null
  status: FeatureStatus
  requirementId: string | null
}

interface RequirementOption {
  id: string
  code: string
  description: string
}

const MAX_VISIBLE_REQS = 2

function resolveDropStatus(overId: string, features: Feature[]): FeatureStatus | null {
  if (isFeatureStatus(overId)) return overId
  const target = features.find((f) => f.id === overId)
  return target?.status ?? null
}

function KanbanCardContent({
  feature,
  projectId,
  requirements,
  onStatusChange,
  isDragging,
  dragHandleProps,
}: {
  feature: Feature
  projectId: string
  requirements: RequirementOption[]
  onStatusChange: (featureId: string, status: FeatureStatus) => void
  isDragging?: boolean
  dragHandleProps?: DraggableSyntheticListeners
}) {
  const linkedIds = getFeatureRequirementIds(
    projectId,
    feature.id,
    feature.requirementId
  )
  const linkedReqs = requirements.filter((r) => linkedIds.includes(r.id))
  const visibleReqs = linkedReqs.slice(0, MAX_VISIBLE_REQS)
  const hiddenCount = linkedReqs.length - visibleReqs.length

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Arrastar ${feature.name}`}
          {...dragHandleProps}
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{feature.name}</p>
          {feature.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {feature.description}
            </p>
          )}
        </div>
      </div>

      {visibleReqs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 pl-6">
          {visibleReqs.map((req) => (
            <Badge key={req.id} variant="secondary" className="text-[10px] font-normal">
              {req.code}
            </Badge>
          ))}
          {hiddenCount > 0 && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              +{hiddenCount}
            </Badge>
          )}
        </div>
      )}

      <div className="mt-3 pl-6">
        <FeatureStatusSelect
          value={feature.status}
          onValueChange={(status) => onStatusChange(feature.id, status)}
        />
      </div>
    </div>
  )
}

function DraggableKanbanCard({
  feature,
  projectId,
  requirements,
  onStatusChange,
}: {
  feature: Feature
  projectId: string
  requirements: RequirementOption[]
  onStatusChange: (featureId: string, status: FeatureStatus) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: feature.id,
    data: { feature },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <KanbanCardContent
        feature={feature}
        projectId={projectId}
        requirements={requirements}
        onStatusChange={onStatusChange}
        isDragging={isDragging}
        dragHandleProps={listeners}
      />
    </div>
  )
}

function KanbanColumn({
  status,
  features,
  projectId,
  requirements,
  onStatusChange,
}: {
  status: FeatureStatus
  features: Feature[]
  projectId: string
  requirements: RequirementOption[]
  onStatusChange: (featureId: string, status: FeatureStatus) => void
}) {
  const display = getFeatureStatusDisplay(status)
  const Icon = display.icon
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      className={cn(
        "flex min-h-[220px] min-w-[280px] flex-1 snap-center flex-col rounded-xl border border-border bg-muted/15",
        display.columnAccent,
        isOver && "ring-2 ring-primary/25 ring-offset-1 ring-offset-background"
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4 shrink-0", display.textClass)} aria-hidden />
          <p className="text-sm font-medium">{display.label}</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {features.length}
        </span>
      </div>

      <div ref={setNodeRef} className="flex flex-1 flex-col gap-2 p-2">
        {features.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 px-3 py-6 text-center">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleDashedIcon className="size-3.5" aria-hidden />
              Nenhuma funcionalidade aqui
            </p>
          </div>
        ) : (
          features.map((feature) => (
            <DraggableKanbanCard
              key={feature.id}
              feature={feature}
              projectId={projectId}
              requirements={requirements}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function KanbanBoard({ projectId }: { projectId: string }) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [requirements, setRequirements] = useState<RequirementOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const [featuresRes, requirementsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/features`),
          fetch(`/api/projects/${projectId}/requirements`),
        ])
        const featuresData = await featuresRes.json()
        const requirementsData = await requirementsRes.json()
        if (!featuresRes.ok) throw new Error(featuresData.error || "Erro ao carregar")
        if (!cancelled) {
          setFeatures(featuresData.features)
          if (requirementsRes.ok) setRequirements(requirementsData.requirements)
        }
      } catch (error) {
        console.error(error)
        toast.error("Não foi possível carregar o Kanban.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const handleStatusChange = async (featureId: string, status: FeatureStatus) => {
    const current = features.find((f) => f.id === featureId)
    if (!current || current.status === status) return
    const previousStatus = current.status

    setFeatures((prev) =>
      prev.map((f) => (f.id === featureId ? { ...f, status } : f))
    )

    try {
      const res = await fetch(`/api/projects/${projectId}/features/${featureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar status")
      setFeatures((prev) =>
        prev.map((f) => (f.id === featureId ? data.feature : f))
      )
    } catch (error) {
      console.error(error)
      setFeatures((prev) =>
        prev.map((f) =>
          f.id === featureId ? { ...f, status: previousStatus } : f
        )
      )
      toast.error(error instanceof Error ? error.message : "Erro ao mover funcionalidade.")
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const feature = features.find((f) => f.id === event.active.id)
    setActiveFeature(feature ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveFeature(null)
    const { active, over } = event
    if (!over) return

    const featureId = String(active.id)
    const newStatus = resolveDropStatus(String(over.id), features)
    if (!newStatus) return

    void handleStatusChange(featureId, newStatus)
  }

  const grouped = useMemo(
    () =>
      FEATURE_STATUSES.reduce(
        (acc, status) => {
          acc[status] = features.filter((f) => f.status === status)
          return acc
        },
        {} as Record<FeatureStatus, Feature[]>
      ),
    [features]
  )

  if (isLoading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">Carregando Kanban...</p>
    )
  }

  if (features.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-4 py-10 text-center">
        <p className="text-sm font-medium">Nenhuma funcionalidade para acompanhar.</p>
        <p className="text-sm text-muted-foreground">
          Crie funcionalidades para começar a acompanhar o desenvolvimento no Kanban.
        </p>
        <Button size="sm" className="gap-1.5" asChild>
          <Link href={`/dashboard/projects/${projectId}/features`}>
            <PlusIcon className="size-4" />
            Criar funcionalidade
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible">
        {FEATURE_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            features={grouped[status]}
            projectId={projectId}
            requirements={requirements}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeFeature ? (
          <div className="w-[280px] rotate-1 cursor-grabbing opacity-95 shadow-lg">
            <KanbanCardContent
              feature={activeFeature}
              projectId={projectId}
              requirements={requirements}
              onStatusChange={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
