import { Button, ButtonGroup, Tooltip } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';

export type DrawingMode =
  | 'select'
  | 'point'
  | 'rectangle'
  | 'circle'
  | 'polygon'
  | 'line'
  | 'delete';

interface DrawingToolbarProps {
  activeMode: DrawingMode;
  onModeChange: (mode: DrawingMode) => void;
  onPrecisionInput?: () => void;
}

/**
 * Drawing toolbar component for map editing
 * Provides tools for creating and editing geospatial features
 */
export function DrawingToolbar({ activeMode, onModeChange, onPrecisionInput }: DrawingToolbarProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '20px',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        borderRadius: '4px',
        padding: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      }}
    >
      <ButtonGroup minimal>
        <Tooltip content="Select Mode (ESC)" position="top">
          <Button
            icon={IconNames.SELECT}
            active={activeMode === 'select'}
            onClick={() => onModeChange('select')}
            intent={activeMode === 'select' ? 'primary' : 'none'}
          />
        </Tooltip>

        <Tooltip content="Add Point (P)" position="top">
          <Button
            icon={IconNames.MAP_MARKER}
            active={activeMode === 'point'}
            onClick={() => onModeChange('point')}
            intent={activeMode === 'point' ? 'primary' : 'none'}
          />
        </Tooltip>

        <Tooltip content="Draw Rectangle (R)" position="top">
          <Button
            icon={IconNames.WIDGET}
            active={activeMode === 'rectangle'}
            onClick={() => onModeChange('rectangle')}
            intent={activeMode === 'rectangle' ? 'primary' : 'none'}
          />
        </Tooltip>

        <Tooltip content="Draw Circle (C)" position="top">
          <Button
            icon={IconNames.FULL_CIRCLE}
            active={activeMode === 'circle'}
            onClick={() => onModeChange('circle')}
            intent={activeMode === 'circle' ? 'primary' : 'none'}
          />
        </Tooltip>

        <Tooltip content="Draw Polygon (G)" position="top">
          <Button
            icon={IconNames.POLYGON_FILTER}
            active={activeMode === 'polygon'}
            onClick={() => onModeChange('polygon')}
            intent={activeMode === 'polygon' ? 'primary' : 'none'}
          />
        </Tooltip>

        <Tooltip content="Draw Line/Route (L)" position="top">
          <Button
            icon={IconNames.TIMELINE_LINE_CHART}
            active={activeMode === 'line'}
            onClick={() => onModeChange('line')}
            intent={activeMode === 'line' ? 'primary' : 'none'}
          />
        </Tooltip>

        <div style={{ borderLeft: '1px solid #444', margin: '0 8px', height: '24px', alignSelf: 'center' }} />

        <Tooltip content="Delete Feature (DEL)" position="top">
          <Button
            icon={IconNames.TRASH}
            active={activeMode === 'delete'}
            onClick={() => onModeChange('delete')}
            intent={activeMode === 'delete' ? 'danger' : 'none'}
          />
        </Tooltip>

        {onPrecisionInput && (
          <>
            <div style={{ borderLeft: '1px solid #444', margin: '0 8px', height: '24px', alignSelf: 'center' }} />
            <Tooltip content="Precision Input (I)" position="top">
              <Button
                icon={IconNames.NUMERICAL}
                onClick={onPrecisionInput}
                intent="none"
              />
            </Tooltip>
          </>
        )}
      </ButtonGroup>
    </div>
  );
}
