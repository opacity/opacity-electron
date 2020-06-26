import { ipcRenderer } from 'electron';
const { dialog } = require('electron').remote;
import Path from 'path';
import slash from 'slash';
import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import Container from 'react-bootstrap/Container';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ButtonToolbar from 'react-bootstrap/ButtonToolbar';
import Card from 'react-bootstrap/Card';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import File from './File';
import Folder from './Folder';
import FormGroup from 'react-bootstrap/FormGroup';
import FormLabel from 'react-bootstrap/FormLabel';
import FormControl from 'react-bootstrap/FormControl';
import Swal from 'sweetalert2';

const Manager = () => {
  const [folderPath, setFolderPath] = useState('/');
  const refFolderPath = useRef(folderPath);
  refFolderPath.current = folderPath;
  const [folders, setFolders] = useState(['All Files']);
  const [metadata, setMetadata] = useState(false);
  const defaultSorts = {
    name: {
      show: false,
      ascending: true,
      icon: '',
    },
    size: {
      show: false,
      ascending: true,
      icon: '',
    },
    createdDate: {
      show: false,
      ascending: true,
      icon: '',
    },
    icons: {
      down: '▼',
      up: '▲',
    },
  };
  const [sorts, setSorts] = useState(JSON.parse(JSON.stringify(defaultSorts)));

  useEffect(() => {
    ipcRenderer.on('metadata:set', (e, newMetadata) => {
      if (newMetadata.folder === refFolderPath.current || newMetadata.force) {
        setMetadata(newMetadata.metadata);
        setSorts(JSON.parse(JSON.stringify(defaultSorts)));
      }
    });
  }, []);

  useEffect(() => {
    ipcRenderer.on('toast:create', (e, data) =>
      toast(data.text, {
        toastId: data.toastId,
        autoClose: false,
      })
    );

    ipcRenderer.on('toast:update', (e, data) => {
      toast.update(data.toastId, {
        render: data.text,
        progress: data.percentage / 100.0,
      });
    });

    ipcRenderer.on('toast:finished', (e, data) => {
      toast.update(data.toastId, {
        render: data.text,
      });
      setTimeout(() => {
        toast.dismiss(data.toastId);
      }, 3000);
    });
  }, []);

  function updatePath(newPath) {
    const updatedPath = slash(Path.join(folderPath, newPath));
    setFolderPath(updatedPath);
    ipcRenderer.send('path:update', updatedPath);
    setFolders([...folders, newPath]);
  }

  function goBackTo(buttonIndex) {
    const newPath = folders.slice(0, buttonIndex + 1);
    setFolders(newPath);
    let traversedPath = [...newPath];
    traversedPath[0] = '/';
    traversedPath = slash(Path.join(...traversedPath));
    setFolderPath(traversedPath);
    ipcRenderer.send('path:update', traversedPath);
  }

  function deleteFunc(handle, toDelete) {
    ipcRenderer.send('file:delete', {
      folder: folderPath,
      handle: handle,
    });
    ipcRenderer.once(`file:deleted:${handle}`, () => {
      toast.update(handle, {
        render: `${toDelete} deleted.`,
      });
      setTimeout(() => {
        toast.dismiss(handle);
      }, 3000);
    });
  }

  function uploadButton(e, isFolder = false) {
    dialog
      .showOpenDialog({
        properties: [
          isFolder ? 'openDirectory' : 'openFile',
          'multiSelections',
        ],
      })
      .then((result) => {
        if (!result.canceled) {
          ipcRenderer.send('files:upload', {
            folder: folderPath,
            files: result.filePaths,
          });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }

  async function downloadFunc(item) {
    dialog
      .showOpenDialog({
        properties: ['openDirectory'],
      })
      .then((result) => {
        if (!result.canceled) {
          ipcRenderer.send('files:download', {
            folder: folderPath,
            files: [item],
            savingPath: result.filePaths[0],
          });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }

  async function newFolder() {
    const { value: folderName } = await Swal.fire({
      title: 'Enter the folder name',
      input: 'text',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return 'You need to write something!';
        }
      },
    });

    if (folderName) {
      Swal.fire('', '', 'success');
      ipcRenderer.send('folder:create', {
        parentFolder: folderPath,
        folderName: folderName,
      });
    }
  }

  async function renameFunc(handle, oldName) {
    const { value: newName } = await Swal.fire({
      title: 'Enter the a new name',
      input: 'text',
      inputValue: oldName,
      showCancelButton: true,
      inputValidator: (value) => {
        if (value === oldName) {
          return 'You need to set a new name!';
        }
        if (!value) {
          return 'Specify a name!';
        }
      },
    });

    if (newName) {
      Swal.fire('', '', 'success');
      ipcRenderer.send('file:rename', {
        folder: folderPath,
        handle: handle,
        newName: newName,
      });
    }
  }

  async function sortName() {
    const copyMetadata = JSON.parse(JSON.stringify(metadata));

    copyMetadata.folders.sort(function (folderA, folderB) {
      return sorts.name.ascending
        ? ('' + folderA.name).localeCompare(folderB.name)
        : ('' + folderB.name).localeCompare(folderA.name);
    });

    copyMetadata.files.sort(function (fileA, fileB) {
      return sorts.name.ascending
        ? ('' + fileA.name).localeCompare(fileB.name)
        : ('' + fileB.name).localeCompare(fileA.name);
    });

    sorts.name.ascending = !sorts.name.ascending;
    sorts.name.show = true;
    sorts.name.icon = sorts.name.ascending ? sorts.icons.down : sorts.icons.up;
    sorts.size = defaultSorts.size;
    sorts.createdDate = defaultSorts.createdDate;
    setSorts(sorts);
    setMetadata(copyMetadata);
  }

  async function sortSize() {
    const copyMetadata = JSON.parse(JSON.stringify(metadata));

    copyMetadata.files.sort(function (fileA, fileB) {
      return sorts.size.ascending
        ? fileA.versions[0].size - fileB.versions[0].size
        : fileB.versions[0].size - fileA.versions[0].size;
    });

    sorts.size.ascending = !sorts.size.ascending;
    sorts.size.show = true;
    sorts.size.icon = sorts.size.ascending ? sorts.icons.down : sorts.icons.up;
    sorts.name = defaultSorts.name;
    sorts.createdDate = defaultSorts.createdDate;
    setSorts(sorts);
    setMetadata(copyMetadata);
  }

  async function sortCreated() {
    const copyMetadata = JSON.parse(JSON.stringify(metadata));

    copyMetadata.files.sort(function (fileA, fileB) {
      return sorts.createdDate.ascending
        ? fileA.created - fileB.created
        : fileB.created - fileA.created;
    });

    sorts.createdDate.ascending = !sorts.createdDate.ascending;
    sorts.createdDate.show = true;
    sorts.createdDate.icon = sorts.createdDate.ascending
      ? sorts.icons.down
      : sorts.icons.up;
    sorts.name = defaultSorts.name;
    sorts.size = defaultSorts.size;
    setSorts(sorts);
    setMetadata(copyMetadata);
  }

  return (
    <Container>
      <ButtonToolbar
        className="justify-content-between"
        aria-label="Toolbar with Button groups"
      >
        <ButtonGroup>
          {folders.map((folder, index) => {
            //if (folders.length - 1 != index) {
            return (
              <Card key={index}>
                <Button onClick={() => goBackTo(index)}>{folder}</Button>
              </Card>
            );
            //}
          })}
        </ButtonGroup>
        <ButtonGroup>
          <Card className="mr-1">
            <Button onClick={() => newFolder()}>Create Folder</Button>
          </Card>
          <Card>
            <Button onClick={(e) => uploadButton(e, true)}>
              Upload Folder
            </Button>
          </Card>
          <Card>
            <Button onClick={uploadButton}>Upload Files</Button>
          </Card>
        </ButtonGroup>
      </ButtonToolbar>
      <Table size="sm">
        <thead>
          <tr>
            <th></th>
            <th></th>
            <th>
              <Button variant="outline-secondary" onClick={sortName}>
                Name
                {sorts.name.show ? ' ' + sorts.name.icon : ''}
              </Button>
            </th>
            <th>
              {' '}
              <Button variant="outline-secondary" onClick={sortCreated}>
                Created
                {sorts.createdDate.show ? ' ' + sorts.createdDate.icon : ''}
              </Button>
            </th>
            <th>
              <Button variant="outline-secondary" onClick={sortSize}>
                Size
                {sorts.size.show ? ' ' + sorts.size.icon : ''}
              </Button>
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {metadata &&
            metadata.folders.map((folder, index) => {
              return (
                <Folder
                  key={index}
                  folder={folder}
                  updatePath={updatePath}
                  downloadFunc={downloadFunc}
                />
              );
            })}
          {metadata &&
            metadata.files.map((file, index) => {
              return (
                <File
                  key={index}
                  file={file}
                  deleteFunc={deleteFunc}
                  downloadFunc={downloadFunc}
                  renameFunc={renameFunc}
                />
              );
            })}
        </tbody>
      </Table>
      <ToastContainer
        position="bottom-right"
        limit={7}
        hideProgressBar={false}
        autoClose={false}
        newestOnTop={true}
        closeOnClick={true}
        draggable={false}
        rtl={false}
      />
    </Container>
  );
};

export default Manager;
