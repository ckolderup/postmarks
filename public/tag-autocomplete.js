const addToTaggedList = (tagToAdd, userSupplied) => {
  const tagEntry = document.querySelector('#tagEntry');
  const taggedList = document.querySelector('#taggedList');
  const datalist = document.querySelector(`#${tagEntry.getAttribute('list')}`);

  const newTag = taggedList.appendChild(document.createElement('span'));
  newTag.classList.add('tagged');
  newTag.innerText = tagToAdd;
  newTag.addEventListener('click', (removeTagEvent) => {
    const formTagList = document.querySelector('#tags');
    const tagList = JSON.parse(decodeURIComponent(formTagList.value) || []);
    formTagList.value = encodeURIComponent(JSON.stringify(tagList.filter((x) => x !== removeTagEvent.target.innerText)));
    removeTagEvent.target.remove();

    // because it's bound when the element is created,
    // we retain the state in the element. nice!
    if (!userSupplied) {
      const insertBefore = [...datalist.children].find((option) => option.value.toLowerCase() > tagToAdd.toLowerCase());
      datalist.insertBefore(document.createElement('option'), insertBefore).value = removeTagEvent.target.innerText;
    }
  });
};

const removeFromDatalist = (tagToRemove) => {
  const tagEntry = document.querySelector('#tagEntry');

  const datalist = document.querySelector(`#${tagEntry.getAttribute('list')}`);

  const autocompleteOption = [...datalist.children].find((option) => option.value === tagToRemove);
  if (autocompleteOption) {
    datalist.removeChild(autocompleteOption);
  }
};

const addToTags = (tagToAdd, userSupplied) => {
  const tagEntry = document.querySelector('#tagEntry');
  const formTagList = document.querySelector('#tags');

  if (JSON.parse(decodeURIComponent(formTagList.value) || '[]').some((x) => x.toLowerCase() === tagToAdd.toLowerCase())) {
    console.log('tag already added');
    tagEntry.value = null;
    tagEntry.blur();
    tagEntry.focus();
    return;
  }

  if (tagToAdd.length < 1) {
    console.log("can't add empty tag");
    return;
  }

  addToTaggedList(tagToAdd, userSupplied);

  const tagList = JSON.parse(decodeURIComponent(formTagList.value) || '[]');
  tagList.push(tagToAdd);
  formTagList.value = encodeURIComponent(JSON.stringify([...new Set(tagList)]));

  removeFromDatalist(tagToAdd);

  // reset the form + autocomplete dropdown
  tagEntry.value = null;
  tagEntry.blur();
  tagEntry.focus();
};

const tagEntry = document.querySelector('#tagEntry');

tagEntry.addEventListener('input', (e) => {
  if (e.inputType === 'insertText') {
    if (e.data === ',' || e.data === '#') {
      addToTags(e.target.value.slice(0, -1), true);
    }
  } else if (e.inputType === 'insertReplacementText' || e.inputType === undefined) {
    // should be things like autocomplete select
    addToTags(e.target.value, false);
  }
});

tagEntry.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    if (e.target.value !== '') {
      e.preventDefault();
      const strippedInput = e.target.value.trim();
      const tagToAdd = [...e.target.list.children].map((x) => x.value).find((x) => new RegExp(`${strippedInput}`, 'i').test(x));
      if (tagToAdd) {
        addToTags(tagToAdd, false);
      }
    }
  } else if (e.key === 'Enter') {
    if (e.target.value !== '') {
      e.preventDefault();
      addToTags(e.target.value, true);
    }
  }
});

document.querySelector('.edit-bookmark form').addEventListener('submit', () => {
  console.log(tagEntry.value);
  if (tagEntry.value.length > 0) {
    addToTags(tagEntry.value, true);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const formTagList = document.querySelector('#tags');
  const taggedList = document.querySelector('#taggedList');
  taggedList.replaceChildren();

  const tags = JSON.parse(decodeURIComponent(formTagList.value) || '[]');
  tags.forEach((tag) => {
    addToTaggedList(tag, false);
    removeFromDatalist(tag);
  });
});
