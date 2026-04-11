import React, { useEffect, useRef, useState } from 'react';
import {
  Type,
  Image as ImageIcon,
  Video,
  Film,
  Music,
  PenTool,
  Layout,
  Upload,
  Trash2,
  Plus,
  Undo2,
  Redo2,
  Clipboard,
  Copy,
  Files,
  Layers,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import { ContextMenuState, NodeType } from '../types';
import { useTranslation } from 'react-i18next';

interface ContextMenuProps {
  state: ContextMenuState;
  sourceNodeType?: NodeType;
  onClose: () => void;
  onSelectType: (type: NodeType | 'DELETE') => void;
  onUpload: (file: File) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onPaste?: () => void;
  onCopy?: () => void;
  onDuplicate?: () => void;
  onCreateAsset?: () => void;
  onAddAssets?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canvasTheme?: 'dark' | 'light';
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  state,
  sourceNodeType,
  onClose,
  onSelectType,
  onUpload,
  onUndo,
  onRedo,
  onPaste,
  onCopy,
  onDuplicate,
  onCreateAsset,
  onAddAssets,
  canUndo = false,
  canRedo = false,
  canvasTheme = 'dark'
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<'main' | 'add-nodes'>('main');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Reset view when menu opens or re-opens (new state)
  useEffect(() => {
    if (state.isOpen && state.type === 'global') {
      setView('main');
    }
  }, [state]);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      onClose();
    }
    // Reset value so same file can be selected again
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleUndo = () => {
    if (onUndo && canUndo) {
      onUndo();
      onClose();
    }
  };

  const handleRedo = () => {
    if (onRedo && canRedo) {
      onRedo();
      onClose();
    }
  };

  const handlePaste = () => {
    if (onPaste) {
      onPaste();
      onClose();
    }
  };


  if (!state.isOpen) return null;

  // 1. Right Click on Node
  if (state.type === 'node-options') {
    return (
      <div
        ref={menuRef}
        style={{ position: 'absolute', left: state.x, top: state.y, zIndex: 1000 }}
        className={`w-48 border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${canvasTheme === 'dark' ? 'bg-[#1e1e1e] border-neutral-800' : 'bg-white border-neutral-200'
          }`}
      >
        <div className="p-1.5 flex flex-col gap-0.5">
          <MenuItem
            icon={<ImageIcon size={16} />}
            label={t('contextMenu.createAsset')}
            onClick={() => {
              if (onCreateAsset) {
                onCreateAsset();
                onClose();
              }
            }}
            active={false}
            canvasTheme={canvasTheme}
          />
          <div className={`my-1 border-t mx-1 ${canvasTheme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`} />

          <MenuItem
            icon={<Copy size={16} />}
            label={t('contextMenu.copy')}
            shortcut="CtrlC"
            onClick={() => {
              if (onCopy) {
                onCopy();
                onClose();
              }
            }}
            canvasTheme={canvasTheme}
          />
          <MenuItem
            icon={<Clipboard size={16} />}
            label={t('contextMenu.paste')}
            shortcut="CtrlV"
            onClick={handlePaste}
            disabled={true} // Disabled in screenshot
            canvasTheme={canvasTheme}
          />
          <MenuItem
            icon={<Files size={16} />}
            label={t('contextMenu.duplicate')}
            onClick={() => {
              if (onDuplicate) {
                onDuplicate();
                onClose();
              }
            }}
          />

          <div className="my-1 border-t border-neutral-800 mx-1" />

          <MenuItem
            icon={<Trash2 size={16} />}
            label={t('contextMenu.delete')}
            shortcut="⌫,del"
            onClick={() => onSelectType('DELETE')}
            canvasTheme={canvasTheme}
          />
        </div>
      </div>
    );
  }

  // 2. Connector Drag Drop (Add Next)
  const connectorSourceType = state.sourceNodeType || sourceNodeType;
  const isConnector = state.type === 'node-connector';
  const isImageConnector =
    isConnector &&
    (connectorSourceType === NodeType.IMAGE || connectorSourceType === NodeType.IMAGE_EDITOR);
  const isLeftConnector = isConnector && state.connectorSide === 'left';
  const allowVideoFromConnector = !(isImageConnector && isLeftConnector);
  const isConnectorTypeEnabled = (targetType: NodeType) => {
    if (!isConnector || !connectorSourceType) return true;

    if (state.connectorSide === 'right') {
      if (connectorSourceType === NodeType.TEXT) {
        return targetType === NodeType.IMAGE || targetType === NodeType.VIDEO;
      }
      if (connectorSourceType === NodeType.IMAGE || connectorSourceType === NodeType.IMAGE_EDITOR) {
        return targetType === NodeType.TEXT || targetType === NodeType.IMAGE || targetType === NodeType.VIDEO;
      }
      if (connectorSourceType === NodeType.VIDEO || connectorSourceType === NodeType.VIDEO_EDITOR) {
        return targetType === NodeType.VIDEO;
      }
      return false;
    }

    if (connectorSourceType === NodeType.IMAGE || connectorSourceType === NodeType.IMAGE_EDITOR) {
      return targetType === NodeType.TEXT || targetType === NodeType.IMAGE;
    }
    if (connectorSourceType === NodeType.VIDEO || connectorSourceType === NodeType.VIDEO_EDITOR) {
      return targetType === NodeType.TEXT || targetType === NodeType.IMAGE || targetType === NodeType.VIDEO;
    }
    return false;
  };

  // If it's the Global Menu (Right Click on Blank), we show the specific options
  if (state.type === 'global' && view === 'main') {
    return (
      <div
        ref={menuRef}
        style={{ position: 'absolute', left: state.x, top: state.y, zIndex: 1000 }}
        className={`w-64 border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${canvasTheme === 'dark' ? 'bg-[#1e1e1e] border-neutral-800' : 'bg-white border-neutral-200'
          }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,video/*"
          onChange={handleFileChange}
        />
        <div className="p-1.5 flex flex-col gap-0.5">
          <MenuItem
            icon={<Upload size={16} />}
            label={t('contextMenu.upload')}
            onClick={handleUploadClick}
            canvasTheme={canvasTheme}
          />
          <MenuItem
            icon={<Layers size={16} />}
            label={t('contextMenu.addAssets')}
            onClick={() => {
              if (onAddAssets) {
                onAddAssets();
                onClose();
              }
            }}
            canvasTheme={canvasTheme}
          />
          <div className={`my-1 border-t mx-1 ${canvasTheme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`} />

          <MenuItem
            icon={<Plus size={16} />}
            label={t('contextMenu.addNodes')}
            rightSlot={<ChevronRight size={14} className={canvasTheme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'} />}
            onClick={() => setView('add-nodes')}
            active={false}
            canvasTheme={canvasTheme}
          />

          <div className={`my-1 border-t mx-1 ${canvasTheme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`} />

          <MenuItem
            icon={<Undo2 size={16} />}
            label={t('contextMenu.undo')}
            shortcut="CtrlZ"
            onClick={handleUndo}
            disabled={!canUndo}
            canvasTheme={canvasTheme}
          />
          <MenuItem
            icon={<Redo2 size={16} />}
            label={t('contextMenu.redo')}
            shortcut="ShiftCtrlZ"
            onClick={handleRedo}
            disabled={!canRedo}
            canvasTheme={canvasTheme}
          />
          <div className={`my-1 border-t mx-1 ${canvasTheme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`} />

          <MenuItem
            icon={<Clipboard size={16} />}
            label={t('contextMenu.paste')}
            shortcut="CtrlV"
            onClick={handlePaste}
            canvasTheme={canvasTheme}
          />
        </div>
      </div >
    );
  }

  // 3. Add Nodes Menu (Global Submenu OR Connector Default)
  const title = isConnector
    ? (isImageConnector ? '引用该节点生成' : t('contextMenu.generateFromNode'))
    : t('contextMenu.addNodes');

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        left: state.x,
        top: state.y,
        zIndex: 1000
      }}
      className={`${
        isConnector
          ? 'w-[268px] rounded-[24px]'
          : 'w-64 rounded-xl'
      } border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${canvasTheme === 'dark' ? (isConnector ? 'bg-[#202020] border-white/10' : 'bg-[#1e1e1e] border-neutral-800') : 'bg-white border-neutral-200'
        }`}
    >
      <div className={`${isConnector ? 'px-5 pt-5 pb-2' : 'px-4 py-3 border-b'} text-sm font-medium ${canvasTheme === 'dark' ? (isConnector ? 'text-neutral-300 border-white/8' : 'text-neutral-300 border-neutral-800') : 'text-neutral-500 border-neutral-100'
        }`}>
        {title}
      </div>

      <div className={`${isConnector ? 'px-4 pb-4' : 'p-2'} flex flex-col gap-1 max-h-[440px] overflow-y-auto`}>
        {(!isConnector || isConnectorTypeEnabled(NodeType.TEXT)) && (
          <MenuItem
            icon={<Type size={18} />}
            label={t('contextMenu.text')}
            desc={isConnector ? undefined : t('contextMenu.textDesc')}
            onClick={() => onSelectType(NodeType.TEXT)}
            variant={isConnector ? 'connector' : 'default'}
            canvasTheme={canvasTheme}
          />
        )}
        {(!isConnector || isConnectorTypeEnabled(NodeType.IMAGE)) && (
          <MenuItem
            icon={<ImageIcon size={18} />}
            label={t('contextMenu.image')}
            desc={isConnector ? undefined : t('contextMenu.imageDesc')}
            active={false}
            onClick={() => onSelectType(NodeType.IMAGE)}
            variant={isConnector ? 'connector' : 'default'}
            canvasTheme={canvasTheme}
          />
        )}
        {(!isConnector || (allowVideoFromConnector && isConnectorTypeEnabled(NodeType.VIDEO))) && (
          <MenuItem
            icon={<Video size={18} />}
            label={t('contextMenu.video')}
            onClick={() => onSelectType(NodeType.VIDEO)}
            variant={isConnector ? 'connector' : 'default'}
            canvasTheme={canvasTheme}
          />
        )}

        {isConnector && isImageConnector && allowVideoFromConnector && (
          <>
            <MenuItem
              icon={<Film size={18} />}
              label="视频合成"
              desc="即将接入"
              badge="Beta"
              disabled
              onClick={() => undefined}
              variant="connector"
              canvasTheme={canvasTheme}
            />
            <MenuItem
              icon={<Music size={18} />}
              label="音频"
              desc="即将接入"
              disabled
              onClick={() => { }}
              variant="connector"
              canvasTheme={canvasTheme}
            />
            <MenuItem
              icon={<Layout size={18} />}
              label="脚本"
              desc="即将接入"
              badge="Beta"
              disabled
              onClick={() => { }}
              variant="connector"
              canvasTheme={canvasTheme}
            />
          </>
        )}

        {!isConnector && (
          <MenuItem
            icon={<PenTool size={18} />}
            label={t('contextMenu.imageEditor')}
            onClick={() => onSelectType(NodeType.IMAGE_EDITOR)}
            canvasTheme={canvasTheme}
          />
        )}

        {!isConnector && (
          <MenuItem
            icon={<Film size={18} />}
            label={t('contextMenu.videoEditor')}
            onClick={() => onSelectType(NodeType.VIDEO_EDITOR)}
            canvasTheme={canvasTheme}
          />
        )}

        {!isConnector && (
          <>
            <div className={`my-2 border-t mx-2 ${canvasTheme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`} />
            <div className={`px-2 py-1 text-xs font-medium ${canvasTheme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {t('contextMenu.localModels')}
            </div>

            <MenuItem
              icon={<HardDrive size={18} />}
              label={t('contextMenu.localImageModel')}
              desc={t('contextMenu.useOpenSourceModels')}
              badge="NEW"
              onClick={() => onSelectType(NodeType.LOCAL_IMAGE_MODEL)}
              canvasTheme={canvasTheme}
            />
            <MenuItem
              icon={<HardDrive size={18} />}
              label={t('contextMenu.localVideoModel')}
              desc={t('contextMenu.animateDiffMore')}
              badge="NEW"
              onClick={() => onSelectType(NodeType.LOCAL_VIDEO_MODEL)}
              canvasTheme={canvasTheme}
            />
          </>
        )}
      </div>
    </div>
  );
};

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  badge?: string;
  shortcut?: string;
  active?: boolean;
  rightSlot?: React.ReactNode;
  disabled?: boolean;
  canvasTheme?: 'dark' | 'light';
  variant?: 'default' | 'connector';
  onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, desc, badge, shortcut, active, rightSlot, disabled, canvasTheme = 'dark', variant = 'default', onClick }) => {
  const isConnector = variant === 'connector';
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`group flex items-center gap-3 w-full ${isConnector ? 'p-2.5 rounded-[18px]' : 'p-2 rounded-lg'} text-left transition-colors 
        ${disabled
          ? (canvasTheme === 'dark' ? 'opacity-30' : 'opacity-25')
          : active
            ? (canvasTheme === 'dark' ? 'bg-[#2a2a2a] text-white' : 'bg-neutral-100 text-neutral-900')
            : (canvasTheme === 'dark'
              ? `${isConnector ? 'text-neutral-200 hover:bg-[#2e2e2e] hover:text-white rounded-[18px] px-1.5 py-2.5' : 'text-neutral-300 hover:bg-[#2a2a2a] hover:text-white'}`
              : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900')}
      `}
    >
      <div className={`flex items-center justify-center ${isConnector ? 'w-10 h-10 rounded-[14px]' : 'w-8 h-8 rounded-md'} transition-colors
        ${active
          ? (canvasTheme === 'dark' ? 'bg-[#3a3a3a]' : 'bg-white')
          : (canvasTheme === 'dark'
            ? `${isConnector ? 'bg-[#313131] text-neutral-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]' : 'bg-[#151515] group-hover:bg-[#3a3a3a]'}`
            : 'bg-neutral-100 group-hover:bg-white border border-transparent group-hover:border-neutral-200')}
        ${disabled ? 'bg-transparent' : ''}
      `}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`${isConnector ? 'text-[15px]' : 'text-sm'} font-medium truncate ${disabled && canvasTheme === 'light' ? 'text-neutral-400' : ''}`}>{label}</span>
          <div className="flex items-center gap-2">
            {badge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${canvasTheme === 'dark' ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                }`}>
                {badge}
              </span>
            )}
            {shortcut && (
              <span className={`text-xs font-sans ${canvasTheme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'
                }`}>{shortcut}</span>
            )}
            {rightSlot}
          </div>
        </div>
        {desc && (
          <p className={`text-xs mt-0.5 truncate ${canvasTheme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'
            }`}>{desc}</p>
        )}
      </div>
    </button>
  );
};
